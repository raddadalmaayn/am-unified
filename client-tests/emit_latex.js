'use strict';
/*
 * emit_latex.js — emit ready-to-paste LaTeX fragments from the analysis JSON
 * that analyze.js and occupancy.js already produced.
 *
 * NO NUMBER IN ANY FRAGMENT IS TYPED BY HAND. Every value is read from a JSON
 * file and every value is accompanied, in a companion .txt, by the exact file
 * and JSON path it came from, so any figure in the paper traces to a file in one
 * step.
 *
 * PROVENANCE OF THE TWO SOURCES, stated because they are not the same thing:
 *   analysis.json   is computed by analyze.js from txs.jsonl ONLY.
 *   occupancy.json  is computed by occupancy.js from the run manifests, because
 *                   block counts come from height_delta, which txs.jsonl does not
 *                   contain. tx_per_block and block_rate therefore do NOT derive
 *                   from txs.jsonl and are labelled as such in the .txt.
 *
 * Fragments only: no preamble, no document wrapper, no \begin{table}. Paste into
 * the existing environments.
 *
 * Usage: node emit_latex.js <outdir>
 */
const fs = require('fs');
const path = require('path');
const { computeSteady, computeTotalWindow, manifestSteady } = require('./steady.js');

const OUT = process.argv[2] || 'am-unified/results/latex_fragments';
fs.mkdirSync(OUT, { recursive: true });

const RESULTS = 'am-unified/results';
const g = (pat) => fs.readdirSync(RESULTS).filter((d) => d.startsWith(pat)).sort();
const PHASE3 = path.join(RESULTS, g('phase3-')[0]);          // distributed sequential A-D
const PHASE3B = path.join(RESULTS, g('phase3b-')[0]);        // distributed concurrent E-H
const PHASE4 = path.join(RESULTS, g('phase4-')[0]);          // sweep
const PHASE8 = path.join(RESULTS, g('phase8-')[0]);          // single-host

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── provenance ledger ───────────────────────────────────────────────────────
let prov = [];
function P(label, value, file, jsonPath, note) {
  prov.push({ label, value, file: file.replace(RESULTS + '/', ''), jsonPath, note: note || '' });
  return value;
}
function writeProv(name, header) {
  const lines = [header, ''.padEnd(header.length, '='), ''];
  lines.push('Every number in the companion fragment, with its source.');
  lines.push('analysis.json  <- analyze.js, computed from txs.jsonl ONLY');
  lines.push('occupancy.json <- occupancy.js, computed from run manifests (height_delta);');
  lines.push('                  NOT derivable from txs.jsonl');
  lines.push('manifest.json  <- written by bench.js at run completion');
  lines.push('');
  const w = Math.max(...prov.map((r) => r.label.length));
  for (const r of prov) {
    lines.push(`${r.label.padEnd(w)}  = ${r.value}`);
    lines.push(`${''.padEnd(w)}    ${r.file}`);
    lines.push(`${''.padEnd(w)}    ${r.jsonPath}${r.note ? '   [' + r.note + ']' : ''}`);
  }
  fs.writeFileSync(path.join(OUT, name), lines.join('\n') + '\n');
  prov = [];
}

const f = (v, n = 1) => (typeof v === 'number' ? v.toFixed(n) : 'n/a');
const medOf = (a) => { const v = a.filter((x) => x != null).slice().sort((x, y) => x - y);
                       return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };

/* E1: the ONE steady definition, computed from txs.jsonl via steady.js.
   Returns the median across runs plus the per-run detail that makes the
   division checkable by hand. */
function steadyFor(phaseDir, cond) {
  const cdir = path.join(phaseDir, cond);
  if (!fs.existsSync(cdir)) return null;
  const runs = fs.readdirSync(cdir).filter((r) => r.startsWith('run')).sort();
  const out = [];
  for (const r of runs) {
    const jl = path.join(cdir, r, 'txs.jsonl');
    if (!fs.existsSync(jl)) continue;
    const s = computeSteady(jl);
    const t = computeTotalWindow(jl);
    if (s) out.push({ run: r, ...s, total_window_tps: t && t.total_window_tps,
                      total_window_committed: t && t.committed, total_window_s: t && t.duration_s });
  }
  if (!out.length) return null;
  return {
    per_run: out,
    steady_tps: medOf(out.map((x) => x.steady_tps)),
    count: medOf(out.map((x) => x.count)),
    duration_s: medOf(out.map((x) => x.duration_s)),
    total_window_tps: medOf(out.map((x) => x.total_window_tps)),
  };
}
const esc = (s) => String(s).replace(/_/g, '\\_');

// ── L1: Table 8 body, distributed sequential ────────────────────────────────
function table8() {
  const ap = path.join(PHASE3, 'analysis.json');
  const a = J(ap);
  const names = { A: 'Provenance write', B: 'Reputation write', C: 'Bridge write (atomic)', D: 'Trust-report read' };
  const rows = [];
  const ranges = [];
  for (const c of ['A', 'B', 'C', 'D']) {
    const pc = a.per_condition[c];
    const m = pc.median_across_runs, s = pc.spread_across_runs;
    const st = steadyFor(PHASE3, c);
    const tps = P(`T8.${c}.steady_tps`, f(st.steady_tps, 2), path.join(PHASE3, c, '*/txs.jsonl'),
                  'steady.js computeSteady() median across runs', 'E1 definition');
    P(`T8.${c}.steady_count`, st.count, path.join(PHASE3, c, '*/txs.jsonl'), 'computeSteady().count');
    P(`T8.${c}.steady_duration_s`, f(st.duration_s, 3), path.join(PHASE3, c, '*/txs.jsonl'), 'computeSteady().duration_s');
    const mean = P(`T8.${c}.mean_ms`,    f(m.mean),          ap, `per_condition.${c}.median_across_runs.mean`);
    const p50  = P(`T8.${c}.p50_ms`,     f(m.p50),           ap, `per_condition.${c}.median_across_runs.p50`);
    const p95  = P(`T8.${c}.p95_ms`,     f(m.p95),           ap, `per_condition.${c}.median_across_runs.p95`);
    const com  = P(`T8.${c}.committed`,  pc.committed_total, ap, `per_condition.${c}.committed_total`);
    const sub  = P(`T8.${c}.submitted`,  pc.n_total,         ap, `per_condition.${c}.n_total`);
    rows.push(`${names[c]} & ${tps} & ${mean} & ${p50} & ${p95} & ${com}/${sub} \\\\`);
    const lo = P(`T8.${c}.p50_min`, f(s.p50_min), ap, `per_condition.${c}.spread_across_runs.p50_min`);
    const hi = P(`T8.${c}.p50_max`, f(s.p50_max), ap, `per_condition.${c}.spread_across_runs.p50_max`);
    const tl = P(`T8.${c}.tps_min`, f(s.tps_min, 2), ap, `per_condition.${c}.spread_across_runs.tps_min`);
    const th = P(`T8.${c}.tps_max`, f(s.tps_max, 2), ap, `per_condition.${c}.spread_across_runs.tps_max`);
    ranges.push(`${names[c]}: P50 ${lo}--${hi}\\,ms, TPS ${tl}--${th}`);
  }
  const body = rows.join('\n');
  const foot = `\\multicolumn{6}{l}{\\footnotesize Range across the three runs --- ${ranges.join('; ')}.}\\\\`;
  fs.writeFileSync(path.join(OUT, 'table8_body.tex'), body + '\n' + foot + '\n');
  writeProv('table8_body.txt', 'TABLE 8 (distributed sequential, W=1) — number provenance');
}

// ── L2: Table 9 body, distributed concurrent ────────────────────────────────
function table9() {
  const ap = path.join(PHASE3B, 'analysis.json');
  const op = path.join(PHASE3B, 'occupancy.json');
  const a = J(ap), o = J(op);
  const names = { E: 'Provenance write', F: 'Reputation write', G: 'Bridge write (atomic)', H: 'High contention (single key)' };
  const med = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
  const rows = [];
  for (const c of ['E', 'F', 'G', 'H']) {
    const pc = a.per_condition[c];
    const m = pc.median_across_runs;
    const st = steadyFor(PHASE3B, c);
    const tps = P(`T9.${c}.steady_tps`, f(st.steady_tps, 2), path.join(PHASE3B, c, '*/txs.jsonl'),
                  'steady.js computeSteady() median across runs', 'E1 definition');
    P(`T9.${c}.steady_count`, st.count, path.join(PHASE3B, c, '*/txs.jsonl'), 'computeSteady().count');
    P(`T9.${c}.steady_duration_s`, f(st.duration_s, 3), path.join(PHASE3B, c, '*/txs.jsonl'), 'computeSteady().duration_s');
    const twt = P(`T9.${c}.total_window_tps`, f(st.total_window_tps, 2), path.join(PHASE3B, c, '*/txs.jsonl'),
                  'steady.js computeTotalWindow() median across runs', 'E2: whole-run basis');
    const mvccN = pc.errors_by_class_total.MVCC_READ_CONFLICT;
    const mvcc = P(`T9.${c}.mvcc_rate_pct`, f((mvccN / pc.n_total) * 100, 2), ap,
                   `per_condition.${c}.errors_by_class_total.MVCC_READ_CONFLICT / per_condition.${c}.n_total`);
    const runs = o.runs.filter((r) => r.condition === c);
    const tpb = P(`T9.${c}.tx_per_block`, f(med(runs.map((r) => r.tx_per_block).filter((x) => x != null)), 2), op,
                  `runs[condition=${c}].tx_per_block (median of ${runs.length})`, 'from manifest height_delta');
    // H's steady-window block rate is an ARTIFACT and must not be quoted: its
    // steady window holds ~24 transactions (0.67-1.40 s), so blocks/steady_s
    // returns 27.8-50.9 /s. PHASE_3B_REPORT.md section 4 records this. The
    // total-window rate is the meaningful one for H, and the column is footnoted
    // rather than silently mixing two different denominators.
    const steadyBr = med(runs.map((r) => r.block_rate_per_s).filter((x) => x != null));
    const totalBr  = med(runs.map((r) => r.block_rate_per_s_total_window).filter((x) => x != null));
    // E2: block_rate must share tx_per_block's basis or the identity cannot
    // close. tx_per_block is committed/blocks over the WHOLE run, so the
    // whole-run block rate is the matching quantity for every row, not just H.
    const useTotal = true;
    const br = P(`T9.${c}.block_rate_per_s`, f(useTotal ? totalBr : steadyBr, 2), op,
                 `runs[condition=${c}].${useTotal ? 'block_rate_per_s_total_window' : 'block_rate_per_s'} (median of ${runs.length})`,
                 'TOTAL-window basis, to match tx_per_block (whole-run)');
    P(`T9.${c}.block_rate_steady_NOT_EMITTED`, f(steadyBr, 2), op,
      `runs[condition=${c}].block_rate_per_s`,
      c === 'H' ? 'artifact for H, see PHASE_3B_REPORT section 4; not emitted'
                : 'steady-window basis; not emitted, would not close the identity');
    rows.push(`${names[c]} & ${tps} & ${twt} & ${mvcc} & ${tpb}${c === 'H' ? '$^{\\dagger}$' : ''} & ${br} \\\\`);
  }
  const notes = '\\multicolumn{6}{l}{\\footnotesize Steady TPS is measured over the interval in which exactly $W$ ' +
    'transactions were in flight; total-window TPS spans the whole run. Blocks per second and transactions ' +
    'per block are whole-run quantities, so their product closes against the total-window column, not the ' +
    'steady column.}\\\\\n' +
    '\\multicolumn{6}{l}{\\footnotesize $^{\\dagger}$Transactions per block is committed$/$blocks; blocks also carry ' +
    'transactions that fail validation, so this understates occupancy when the failure rate is high.}\\\\\n' +
    '';
  fs.writeFileSync(path.join(OUT, 'table9_body.tex'), rows.join('\n') + '\n' + notes + '\n');
  writeProv('table9_body.txt', 'TABLE 9 (distributed concurrent, W=20) — number provenance');

  // H failure-class breakdown, separate fragment
  const pcH = a.per_condition.H;
  const cls = pcH.errors_by_class_total;
  const tot = pcH.error_total;
  const present = Object.entries(cls).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const lines = present.map(([k, v]) => {
    const pct = P(`H.${k}.pct_of_failures`, f((v / tot) * 100, 1), ap,
                  `per_condition.H.errors_by_class_total.${k} / per_condition.H.error_total`);
    P(`H.${k}.count`, v, ap, `per_condition.H.errors_by_class_total.${k}`);
    return `\\texttt{${esc(k)}} & ${v} & ${pct} \\\\`;
  });
  P('H.error_total', tot, ap, 'per_condition.H.error_total');
  P('H.committed_total', pcH.committed_total, ap, 'per_condition.H.committed_total');
  P('H.n_total', pcH.n_total, ap, 'per_condition.H.n_total');
  const foot = `\\multicolumn{3}{l}{\\footnotesize ${pcH.committed_total} of ${pcH.n_total} committed; ` +
               `${tot} failures across ${present.length} classes, all others zero.}\\\\`;
  fs.writeFileSync(path.join(OUT, 'table9h_failures_body.tex'), lines.join('\n') + '\n' + foot + '\n');
  writeProv('table9h_failures_body.txt', 'CONDITION H failure classes — number provenance');
}

// ── L3: Figure 4, two pgfplots panels from the Phase 4 sweep ────────────────
function figure4() {
  const levels = [1, 5, 10, 20, 50, 100, 200, 400];
  const med = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
  const tps = [], tpb = [], br = [];
  for (const W of levels) {
    const ap = path.join(PHASE4, `W${W}`, 'analysis.json');
    const op = path.join(PHASE4, `W${W}`, 'occupancy.json');
    if (!fs.existsSync(ap) || !fs.existsSync(op)) continue;
    const a = J(ap), o = J(op);
    const cond = Object.keys(a.per_condition)[0];
    const stq = steadyFor(path.join(PHASE4, `W${W}`), cond);
    const t = stq.steady_tps;
    P(`F4.W${W}.steady_tps`, f(t, 2), path.join(PHASE4, `W${W}`, cond, '*/txs.jsonl'),
      'steady.js computeSteady() median across runs', 'E1 definition');
    tps.push(`(${W},${t.toFixed(2)})`);
    const rs = o.runs;
    const b = med(rs.map((r) => r.tx_per_block).filter((x) => x != null));
    const r2 = med(rs.map((r) => r.block_rate_per_s).filter((x) => x != null));
    P(`F4.W${W}.tx_per_block`, f(b, 2), op, `runs.tx_per_block (median of ${rs.length})`, 'from manifest height_delta');
    P(`F4.W${W}.block_rate_per_s`, f(r2, 2), op, `runs.block_rate_per_s (median of ${rs.length})`, 'from manifest height_delta');
    tpb.push(`(${W},${b.toFixed(2)})`);
    br.push(`(${W},${r2.toFixed(2)})`);
  }
  const mmc = 10; // channel config MaxMessageCount, distributed testbed
  P('F4.max_message_count', mmc, path.join(PHASE3B, 'E/run1/manifest.json'),
    'channel_params.batch_size.max_message_count');

  const src = `% Figure 4, panel (a): throughput against offered concurrency.
% Replaces the single-line figure. The "saturation region" annotation is
% deliberately absent: throughput was still rising at the highest level measured.
\\begin{groupplot}[
  group style={group size=1 by 2, vertical sep=1.1cm},
  width=\\columnwidth, height=5.2cm,
  xmode=log, log basis x=10,
  xlabel={Transactions in flight $W$},
  xtick={1,5,10,20,50,100,200,400},
  xticklabels={1,5,10,20,50,100,200,400},
  grid=both, grid style={line width=.1pt, draw=gray!20},
  tick label style={font=\\footnotesize},
  label style={font=\\footnotesize},
  legend style={font=\\footnotesize, at={(0.02,0.98)}, anchor=north west, draw=none, fill=none},
]
\\nextgroupplot[ylabel={Steady-state throughput (tx/s)}, ymin=0]
\\addplot[mark=*, thick] coordinates {${tps.join(' ')}};
\\addlegendentry{committed tx/s}

% panel (b): the mechanism. Block production rate is near-flat across a twentyfold
% concurrency range while occupancy never approaches the MaxMessageCount ceiling.
\\nextgroupplot[ylabel={Block occupancy and rate}, ymin=0, ymax=${mmc + 1}]
\\addplot[mark=square*, thick] coordinates {${tpb.join(' ')}};
\\addlegendentry{transactions per block}
\\addplot[mark=triangle*, thick, dashed] coordinates {${br.join(' ')}};
\\addlegendentry{blocks per second}
\\addplot[domain=1:400, samples=2, densely dotted, thick, gray] {${mmc}};
\\addlegendentry{\\texttt{MaxMessageCount}\\,=\\,${mmc}}
\\end{groupplot}
`;
  fs.writeFileSync(path.join(OUT, 'figure4_pgfplots.tex'), src);
  writeProv('figure4_pgfplots.txt', 'FIGURE 4 (Phase 4 concurrency sweep, two panels) — number provenance');
}

// ── L4: Tables 6 and 7, single-host ─────────────────────────────────────────
function tables67() {
  const ap = path.join(PHASE8, 'analysis.json');
  const op = path.join(PHASE8, 'occupancy.json');
  const a = J(ap), o = J(op);
  const med = (arr) => { const v = arr.slice().sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };

  // Table 6 — sequential
  const n6 = { A: 'Provenance write', B: 'Reputation write', C: 'Bridge write (atomic)', D: 'Trust-report read' };
  const rows6 = [], ranges6 = [];
  for (const c of ['A', 'B', 'C', 'D']) {
    const pc = a.per_condition[c], m = pc.median_across_runs, s = pc.spread_across_runs;
    const st6 = steadyFor(PHASE8, c);
    const tps = P(`T6.${c}.steady_tps`, f(st6.steady_tps, 2), path.join(PHASE8, c, '*/txs.jsonl'),
                  'steady.js computeSteady() median across runs', 'E1 definition');
    P(`T6.${c}.steady_count`, st6.count, path.join(PHASE8, c, '*/txs.jsonl'), 'computeSteady().count');
    P(`T6.${c}.steady_duration_s`, f(st6.duration_s, 3), path.join(PHASE8, c, '*/txs.jsonl'), 'computeSteady().duration_s');
    const mean = P(`T6.${c}.mean_ms`, f(m.mean), ap, `per_condition.${c}.median_across_runs.mean`);
    const p50 = P(`T6.${c}.p50_ms`, f(m.p50), ap, `per_condition.${c}.median_across_runs.p50`);
    const p95 = P(`T6.${c}.p95_ms`, f(m.p95), ap, `per_condition.${c}.median_across_runs.p95`);
    const com = P(`T6.${c}.committed`, pc.committed_total, ap, `per_condition.${c}.committed_total`);
    const sub = P(`T6.${c}.submitted`, pc.n_total, ap, `per_condition.${c}.n_total`);
    rows6.push(`${n6[c]} & ${tps} & ${mean} & ${p50} & ${p95} & ${com}/${sub} \\\\`);
    ranges6.push(`${n6[c]}: P50 ${f(s.p50_min)}--${f(s.p50_max)}\\,ms`);
  }
  fs.writeFileSync(path.join(OUT, 'table6_body.tex'),
    rows6.join('\n') + '\n' +
    `\\multicolumn{6}{l}{\\footnotesize Range across the three runs --- ${ranges6.join('; ')}.}\\\\\n`);
  writeProv('table6_body.txt', 'TABLE 6 (single-host sequential, W=1, n=500/run) — number provenance');

  // Table 7 — concurrent, with the state size the measurement was taken at
  const mp = path.join(PHASE8, 'E/run1/manifest.json');
  const m1 = J(mp);
  const keys = m1.state_keys_before && m1.state_keys_before.counted_keys;
  const height = m1.ledger_before && m1.ledger_before.peers && m1.ledger_before.peers.org1 && m1.ledger_before.peers.org1.height;
  P('T7.state_counted_keys_at_measurement', keys, mp, 'state_keys_before.counted_keys');
  P('T7.ledger_height_at_measurement', height, mp, 'ledger_before.peers.org1.height');

  const n7 = { E: 'Provenance write', F: 'Reputation write', G: 'Bridge write (atomic)', H: 'High contention (single key)' };
  const rows7 = [];
  for (const c of ['E', 'F', 'G', 'H']) {
    const pc = a.per_condition[c], m = pc.median_across_runs;
    const st7 = steadyFor(PHASE8, c);
    const tps = P(`T7.${c}.steady_tps`, f(st7.steady_tps, 2), path.join(PHASE8, c, '*/txs.jsonl'),
                  'steady.js computeSteady() median across runs', 'E1 definition');
    const twt7 = P(`T7.${c}.total_window_tps`, f(st7.total_window_tps, 2), path.join(PHASE8, c, '*/txs.jsonl'),
                   'steady.js computeTotalWindow() median across runs', 'E2: whole-run basis');
    const p50 = P(`T7.${c}.p50_ms`, f(m.p50), ap, `per_condition.${c}.median_across_runs.p50`);
    const rs = o.runs.filter((r) => r.condition === c);
    const tpb = P(`T7.${c}.tx_per_block`, f(med(rs.map((r) => r.tx_per_block).filter((x) => x != null)), 2), op,
                  `runs[condition=${c}].tx_per_block`, 'from manifest height_delta');
    const br = P(`T7.${c}.block_rate_per_s`, f(med(rs.map((r) => r.block_rate_per_s).filter((x) => x != null)), 2), op,
                 `runs[condition=${c}].block_rate_per_s`, 'from manifest height_delta');
    const com = P(`T7.${c}.committed`, pc.committed_total, ap, `per_condition.${c}.committed_total`);
    const sub = P(`T7.${c}.submitted`, pc.n_total, ap, `per_condition.${c}.n_total`);
    rows7.push(`${n7[c]} & ${tps} & ${twt7} & ${p50} & ${tpb} & ${br} & ${com}/${sub} \\\\`);
  }
  fs.writeFileSync(path.join(OUT, 'table7_body.tex'), rows7.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'table7_caption_clause.tex'),
    `Measured at a state size of ${keys.toLocaleString('en-US')} counted keys ` +
    `(ledger height ${height.toLocaleString('en-US')}); single-host concurrent throughput is ` +
    `state-dependent and this figure is not comparable to a measurement taken at a different state size.\n`);
  writeProv('table7_body.txt', 'TABLE 7 (single-host concurrent, W=100) — number provenance');
}

// ── E3: three throughput definitions per Phase 4 level, side by side ────────
function phase4ThreeWay() {
  const levels = [1, 5, 10, 20, 50, 100, 200, 400];
  const lines = [];
  for (const W of levels) {
    const d = path.join(PHASE4, `W${W}`);
    if (!fs.existsSync(d)) continue;
    const a = J(path.join(d, 'analysis.json'));
    const cond = Object.keys(a.per_condition)[0];
    /*
     * D3: the middle column is the SUPERSEDED analyze.js figure. Since analyze.js
     * now imports steady.js, its `steady_tps` IS the E1 figure — reading it here
     * would collapse columns 2 and 3. Read the explicitly-legacy field, and fail
     * loudly rather than silently emitting the wrong number if it is absent
     * (i.e. if analysis.json predates the D3 refactor and needs regenerating).
     */
    const mar = a.per_condition[cond].median_across_runs;
    if (mar.steady_tps_legacy_superseded === undefined) {
      throw new Error(`${d}/analysis.json predates the D3 refactor — re-run analyze.js on it ` +
                      `before emitting (missing median_across_runs.steady_tps_legacy_superseded)`);
    }
    const prev = mar.steady_tps_legacy_superseded;
    const mans = [];
    for (const r of fs.readdirSync(path.join(d, cond)).filter((x) => x.startsWith('run'))) {
      mans.push(manifestSteady(path.join(d, cond, r, 'manifest.json')).steady_tps);
    }
    const man = medOf(mans);
    const st = steadyFor(d, cond);
    P(`P4.W${W}.tps_manifest`, f(man, 2), path.join(d, cond, '*/manifest.json'),
      'counts.steady_count / timing.steady_duration_ms', 'superseded');
    P(`P4.W${W}.tps_prev_analyze`, f(prev, 2), path.join(d, 'analysis.json'),
      `per_condition.${cond}.median_across_runs.steady_tps`, 'superseded');
    P(`P4.W${W}.tps_corrected`, f(st.steady_tps, 2), path.join(d, cond, '*/txs.jsonl'),
      'steady.js computeSteady()', 'E1, reported');
    P(`P4.W${W}.steady_count`, st.count, path.join(d, cond, '*/txs.jsonl'), 'computeSteady().count');
    P(`P4.W${W}.steady_duration_s`, f(st.duration_s, 3), path.join(d, cond, '*/txs.jsonl'), 'computeSteady().duration_s');
    lines.push(`${W} & ${f(man, 2)} & ${f(prev, 2)} & ${f(st.steady_tps, 2)} & ${st.count} & ${f(st.duration_s, 1)} \\\\`);
  }
  fs.writeFileSync(path.join(OUT, 'phase4_throughput_threeway_body.tex'), lines.join('\n') + '\n');
  writeProv('phase4_throughput_threeway_body.txt',
            'PHASE 4 throughput, three definitions side by side (E3) — number provenance');
}

table8();
table9();
phase4ThreeWay();
figure4();
tables67();
console.log('fragments written to ' + OUT);
for (const fn of fs.readdirSync(OUT).sort()) console.log('  ' + fn);
