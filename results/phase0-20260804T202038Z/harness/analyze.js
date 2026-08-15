'use strict';
/**
 * analyze.js — statistics for the AM distributed benchmark.
 *
 * READS ONLY txs.jsonl. It never opens manifest.json, resources.csv, stdout.log
 * or any summary file. Every number it emits is recomputable from the raw
 * per-transaction records alone. If a statistic cannot be derived from the
 * JSONL, it is not reported.
 *
 * Usage:
 *   node analyze.js <resultsRoot> [--json out.json] [--md out.md]
 */

const fs   = require('fs');
const path = require('path');

const ALL_ERROR_CLASSES = [
  'MVCC_READ_CONFLICT', 'PHANTOM_READ_CONFLICT', 'ENDORSEMENT_POLICY_FAILURE',
  'CHAINCODE_REJECT', 'ENDORSE_MISMATCH', 'GATEWAY_DEADLINE', 'GATEWAY_UNAVAILABLE',
  'ORDERER_UNAVAILABLE', 'COMMIT_TIMEOUT', 'OTHER',
];

// ── statistics ──────────────────────────────────────────────────────────────
function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; }

/** Nearest-rank percentile on a pre-sorted ascending array. */
function pct(sorted, p) {
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Wilson 95% upper bound on a proportion with k events in n trials. */
function wilsonUpper(k, n, z = 1.96) {
  if (n === 0) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return ((c + s) / d) * 100;
}

/** Rule of three: 95% upper bound when zero events observed (Hanley 1983). */
function ruleOfThreeUpper(n) { return n === 0 ? null : (3 / n) * 100; }

// ── file walking ────────────────────────────────────────────────────────────
function findJsonl(root) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'txs.jsonl') out.push(p);
    }
  })(root);
  return out.sort();
}

function readRun(file) {
  const recs = [];
  const raw = fs.readFileSync(file, 'utf8');
  let bad = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { recs.push(JSON.parse(line)); } catch (e) { bad++; }
  }
  return { recs, malformed: bad };
}

// ── per-run analysis ────────────────────────────────────────────────────────
function analyzeRun(file) {
  const { recs, malformed } = readRun(file);
  if (!recs.length) return null;

  const condition = recs[0].condition;
  const run_id    = recs[0].run_id;
  const run_index = recs[0].run_index;

  const submitted = recs.length;
  const committed = recs.filter(r => r.status === 'COMMITTED').length;

  const byClass = {};
  for (const c of ALL_ERROR_CLASSES) byClass[c] = 0;
  let unclassified = 0;
  for (const r of recs) {
    if (r.status === 'COMMITTED') continue;
    if (r.error_class && byClass.hasOwnProperty(r.error_class)) byClass[r.error_class]++;
    else unclassified++;
  }
  const errorTotal = Object.values(byClass).reduce((a, b) => a + b, 0) + unclassified;
  const invariant_holds = (submitted === committed + errorTotal);

  // Latency over COMMITTED, steady-state (non-warmup) transactions only.
  const steady = recs.filter(r => r.status === 'COMMITTED' && !r.warmup);
  const tot = steady.map(r => r.latency_total_ms).filter(v => typeof v === 'number').sort((a, b) => a - b);
  const end = steady.map(r => r.latency_endorse_ms).filter(v => typeof v === 'number');
  const ord = steady.map(r => r.latency_order_commit_ms).filter(v => typeof v === 'number');

  // Steady-state throughput derived purely from the JSONL: the window runs from
  // the last warm-up completion to the last steady completion, using t_committed_ns.
  const commitTimes = steady.map(r => r.t_committed_ns).filter(Boolean).map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let steady_tps = null, steady_window_ms = null;
  if (commitTimes.length >= 2) {
    steady_window_ms = Number(commitTimes[commitTimes.length - 1] - commitTimes[0]) / 1e6;
    // n-1 completions occur strictly inside the window between first and last.
    steady_tps = steady_window_ms > 0 ? ((commitTimes.length - 1) / (steady_window_ms / 1000)) : null;
  }

  const warmupCount = recs.filter(r => r.warmup).length;
  const slots = new Set(recs.map(r => r.worker_slot)).size;

  const stats = {
    run_id, condition, run_index, file,
    malformed_lines: malformed,
    submitted, committed, warmup_count: warmupCount, steady_count: steady.length,
    observed_worker_slots: slots,
    errors_by_class: byClass, unclassified, error_total: errorTotal, invariant_holds,
    latency_total_ms: {
      n: tot.length, mean: mean(tot), p50: pct(tot, 50), p95: pct(tot, 95),
      p99: pct(tot, 99), min: tot.length ? tot[0] : null,
      max: tot.length ? tot[tot.length - 1] : null,
    },
    latency_endorse_ms: { n: end.length, median: median(end) },
    latency_order_commit_ms: { n: ord.length, median: median(ord) },
    steady_state: { window_ms: steady_window_ms, tps: steady_tps },
  };
  return stats;
}

// ── per-condition aggregation ───────────────────────────────────────────────
function aggregate(runStats) {
  const byCond = {};
  for (const r of runStats) {
    if (!r) continue;
    (byCond[r.condition] = byCond[r.condition] || []).push(r);
  }
  const out = {};
  for (const [cond, runs] of Object.entries(byCond)) {
    runs.sort((a, b) => a.run_index - b.run_index);
    const n = runs.reduce((s, r) => s + r.submitted, 0);
    const committed = runs.reduce((s, r) => s + r.committed, 0);
    const classTotals = {};
    for (const c of ALL_ERROR_CLASSES) classTotals[c] = runs.reduce((s, r) => s + (r.errors_by_class[c] || 0), 0);
    const errorTotal = Object.values(classTotals).reduce((a, b) => a + b, 0);

    const p50s = runs.map(r => r.latency_total_ms.p50).filter(v => v != null);
    const tpss = runs.map(r => r.steady_state.tps).filter(v => v != null);

    // Zero-event bounds, per class.
    const zeroBounds = {};
    for (const c of ALL_ERROR_CLASSES) {
      if (classTotals[c] === 0 && n > 0) {
        zeroBounds[c] = { rule_of_three_upper_pct: ruleOfThreeUpper(n), wilson_upper_pct: wilsonUpper(0, n) };
      }
    }

    out[cond] = {
      condition: cond, runs: runs.length,
      n_total: n, committed_total: committed, error_total: errorTotal,
      errors_by_class_total: classTotals,
      zero_event_upper_bounds: zeroBounds,
      invariant_holds_all_runs: runs.every(r => r.invariant_holds),
      per_run: runs.map(r => ({
        run_index: r.run_index, submitted: r.submitted, committed: r.committed,
        mean: r.latency_total_ms.mean, p50: r.latency_total_ms.p50,
        p95: r.latency_total_ms.p95, p99: r.latency_total_ms.p99,
        min: r.latency_total_ms.min, max: r.latency_total_ms.max,
        endorse_median: r.latency_endorse_ms.median,
        order_commit_median: r.latency_order_commit_ms.median,
        steady_tps: r.steady_state.tps,
        errors_by_class: r.errors_by_class,
      })),
      median_across_runs: {
        p50: median(p50s), steady_tps: median(tpss),
        mean: median(runs.map(r => r.latency_total_ms.mean).filter(v => v != null)),
        p95: median(runs.map(r => r.latency_total_ms.p95).filter(v => v != null)),
        p99: median(runs.map(r => r.latency_total_ms.p99).filter(v => v != null)),
        endorse_median: median(runs.map(r => r.latency_endorse_ms.median).filter(v => v != null)),
        order_commit_median: median(runs.map(r => r.latency_order_commit_ms.median).filter(v => v != null)),
      },
      spread_across_runs: {
        p50_min: p50s.length ? Math.min(...p50s) : null,
        p50_max: p50s.length ? Math.max(...p50s) : null,
        p50_spread: p50s.length ? Math.max(...p50s) - Math.min(...p50s) : null,
        tps_min: tpss.length ? Math.min(...tpss) : null,
        tps_max: tpss.length ? Math.max(...tpss) : null,
        tps_spread: tpss.length ? Math.max(...tpss) - Math.min(...tpss) : null,
      },
    };
  }
  return out;
}

// ── markdown rendering ──────────────────────────────────────────────────────
function f(v, d = 1) { return v == null ? 'n/a' : Number(v).toFixed(d); }

function toMarkdown(agg, runStats) {
  const L = [];
  L.push('# Benchmark analysis');
  L.push('');
  L.push('Derived solely from `txs.jsonl`. No summary file was read.');
  L.push('');
  L.push('## Per-condition summary (median across runs)');
  L.push('');
  L.push('| Cond | Runs | n | Committed | Errors | Mean ms | P50 ms | P95 ms | P99 ms | Endorse ms | Order+Commit ms | Steady TPS |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.keys(agg).sort()) {
    const a = agg[c], m = a.median_across_runs;
    L.push(`| ${c} | ${a.runs} | ${a.n_total} | ${a.committed_total} | ${a.error_total} | ${f(m.mean)} | ${f(m.p50)} | ${f(m.p95)} | ${f(m.p99)} | ${f(m.endorse_median)} | ${f(m.order_commit_median)} | ${f(m.steady_tps, 2)} |`);
  }
  L.push('');
  L.push('## Per-run spread');
  L.push('');
  L.push('| Cond | P50 min | P50 max | P50 spread | TPS min | TPS max | TPS spread | Invariant all runs |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const c of Object.keys(agg).sort()) {
    const s = agg[c].spread_across_runs;
    L.push(`| ${c} | ${f(s.p50_min)} | ${f(s.p50_max)} | ${f(s.p50_spread)} | ${f(s.tps_min, 2)} | ${f(s.tps_max, 2)} | ${f(s.tps_spread, 2)} | ${agg[c].invariant_holds_all_runs ? 'OK' : 'VIOLATED'} |`);
  }
  L.push('');
  L.push('## Failure breakdown by class');
  L.push('');
  const used = ALL_ERROR_CLASSES.filter(c => Object.values(agg).some(a => a.errors_by_class_total[c] > 0));
  if (!used.length) {
    L.push('No failures recorded in any condition.');
  } else {
    L.push('| Cond | n | ' + used.join(' | ') + ' |');
    L.push('|---|---|' + used.map(() => '---').join('|') + '|');
    for (const c of Object.keys(agg).sort()) {
      const a = agg[c];
      L.push(`| ${c} | ${a.n_total} | ` + used.map(k => {
        const v = a.errors_by_class_total[k];
        const pctv = a.n_total ? (100 * v / a.n_total).toFixed(2) : '0.00';
        return `${v} (${pctv}%)`;
      }).join(' | ') + ' |');
    }
  }
  L.push('');
  L.push('## Zero-event upper bounds (95%)');
  L.push('');
  L.push('| Cond | n | Class | Rule-of-three upper | Wilson upper |');
  L.push('|---|---|---|---|---|');
  for (const c of Object.keys(agg).sort()) {
    const a = agg[c];
    for (const [cls, b] of Object.entries(a.zero_event_upper_bounds)) {
      L.push(`| ${c} | ${a.n_total} | ${cls} | ${f(b.rule_of_three_upper_pct, 4)}% | ${f(b.wilson_upper_pct, 4)}% |`);
    }
  }
  L.push('');
  L.push('## Per-run detail');
  L.push('');
  L.push('| Cond | Run | Submitted | Committed | Mean | P50 | P95 | P99 | Min | Max | Steady TPS |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.keys(agg).sort()) {
    for (const r of agg[c].per_run) {
      L.push(`| ${c} | ${r.run_index} | ${r.submitted} | ${r.committed} | ${f(r.mean)} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.p99)} | ${f(r.min)} | ${f(r.max)} | ${f(r.steady_tps, 2)} |`);
    }
  }
  return L.join('\n');
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  const root = process.argv[2];
  if (!root) { console.error('usage: node analyze.js <resultsRoot> [--json out] [--md out]'); process.exit(2); }
  const args = {};
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1];
  }

  const files = findJsonl(root);
  if (!files.length) { console.error(`no txs.jsonl under ${root}`); process.exit(1); }
  const runStats = files.map(analyzeRun).filter(Boolean);
  const agg = aggregate(runStats);

  const payload = {
    generated_at: new Date().toISOString(),
    source_root: path.resolve(root),
    files_read: files,
    note: 'Computed exclusively from txs.jsonl records.',
    per_run: runStats,
    per_condition: agg,
  };

  const jsonOut = args.json || path.join(root, 'analysis.json');
  const mdOut   = args.md   || path.join(root, 'analysis.md');
  fs.writeFileSync(jsonOut, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdOut, toMarkdown(agg, runStats));
  console.log(toMarkdown(agg, runStats));
  console.log(`\nwrote ${jsonOut}`);
  console.log(`wrote ${mdOut}`);

  const violations = runStats.filter(r => !r.invariant_holds);
  if (violations.length) {
    console.error(`\nINVARIANT VIOLATED in ${violations.length} run(s):`);
    for (const v of violations) console.error(`  ${v.run_id}: submitted=${v.submitted} committed=${v.committed} errors=${v.error_total}`);
    process.exitCode = 3;
  }
}

main();
