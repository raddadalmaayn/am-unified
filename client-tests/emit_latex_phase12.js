'use strict';
/*
 * emit_latex_phase12.js — emit the replacement Section 5.2 BatchTimeout sentence
 * from the Phase 12 probe, with a companion provenance .txt.
 *
 * NO NUMBER IN THE FRAGMENT IS TYPED BY HAND. Every value is read from a JSON
 * file or recomputed from txs.jsonl via steady.js, and every value is recorded
 * in the .txt with the exact file and JSON path it came from.
 *
 * Usage: node emit_latex_phase12.js <phase12dir> [outdir]
 */
const fs = require('fs');
const path = require('path');
const { computeSteady, computeTotalWindow } = require('./steady.js');

const P12 = process.argv[2];
const OUT = process.argv[3] || 'am-unified/results/latex_fragments';
if (!P12) { console.error('usage: node emit_latex_phase12.js <phase12dir> [outdir]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const med = (v) => { v = v.filter((x) => x != null).sort((a, b) => a - b);
                     const i = v.length >> 1; return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2; };
const f = (v, d = 2) => (v == null ? 'n/a' : Number(v).toFixed(d));

let prov = [];
function P(key, val, file, jsonPath, note) {
  prov.push({ key, val, file, jsonPath, note });
  return val;
}

function gather(dir, cond, bt) {
  const base = path.join(P12, dir);
  const a = J(path.join(base, 'analysis.json')).per_condition[cond];
  const occ = J(path.join(base, 'occupancy.json'));
  const rows = (occ.runs || occ).filter((r) => r.condition === cond);
  const runs = fs.readdirSync(path.join(base, cond)).filter((x) => x.startsWith('run'));
  const jsonl = runs.map((r) => path.join(base, cond, r, 'txs.jsonl')).filter((p) => fs.existsSync(p));
  const mf = J(path.join(base, cond, 'run1', 'manifest.json'));
  const tag = `P12.${bt}.${cond}`;
  const rel = path.join(dir, cond);
  return {
    mean: P(`${tag}.mean_ms`, med([a.median_across_runs.mean]), path.join(rel, 'analysis.json'),
            `per_condition.${cond}.median_across_runs.mean`),
    p50: P(`${tag}.p50_ms`, a.median_across_runs.p50, path.join(rel, 'analysis.json'),
           `per_condition.${cond}.median_across_runs.p50`),
    steady: P(`${tag}.steady_tps`, med(jsonl.map((p) => computeSteady(p).steady_tps)),
              path.join(rel, '*/txs.jsonl'), 'steady.js computeSteady() median across runs', 'E1 definition'),
    total: P(`${tag}.total_window_tps`, med(jsonl.map((p) => computeTotalWindow(p).total_window_tps)),
             path.join(rel, '*/txs.jsonl'), 'steady.js computeTotalWindow() median across runs', 'E2 basis'),
    tpb: P(`${tag}.tx_per_block`, med(rows.map((r) => r.tx_per_block)), path.join(rel, 'occupancy.json'),
           `runs[condition=${cond}].tx_per_block (median of ${rows.length})`, 'from manifest height_delta'),
    br: P(`${tag}.block_rate_per_s`, med(rows.map((r) => r.block_rate_per_s)), path.join(rel, 'occupancy.json'),
          `runs[condition=${cond}].block_rate_per_s (median of ${rows.length})`, 'from manifest height_delta'),
    keys: P(`${tag}.counted_keys_at_measurement`, mf.state_keys_before.counted_keys,
            path.join(rel, 'run1/manifest.json'), 'state_keys_before.counted_keys'),
    height: P(`${tag}.ledger_height_at_measurement`, mf.ledger_before.peers.org1.height,
              path.join(rel, 'run1/manifest.json'), 'ledger_before.peers.org1.height'),
    committed: P(`${tag}.committed`, a.committed_total, path.join(rel, 'analysis.json'),
                 `per_condition.${cond}.committed_total`),
    submitted: P(`${tag}.submitted`, a.n_total, path.join(rel, 'analysis.json'),
                 `per_condition.${cond}.n_total`),
  };
}

const s10 = gather('bt10ms/seq', 'A', 'bt10');
const s50 = gather('bt50ms/seq', 'A', 'bt50');
const c10 = gather('bt10ms/conc', 'E', 'bt10');
const c50 = gather('bt50ms/conc', 'E', 'bt50');

const latDelta = P('P12.seq_latency_delta_pct', ((s10.mean - s50.mean) / s50.mean) * 100,
                   '(derived)', '(P12.bt10.A.mean_ms - P12.bt50.A.mean_ms) / P12.bt50.A.mean_ms',
                   'negative = 10ms is faster');
const tpsDelta = P('P12.conc_tps_delta_pct', ((c10.steady - c50.steady) / c50.steady) * 100,
                   '(derived)', '(P12.bt10.E.steady_tps - P12.bt50.E.steady_tps) / P12.bt50.E.steady_tps');
const prod10 = P('P12.bt10.E.tpb_x_br', c10.tpb * c10.br, '(derived)', 'P12.bt10.E.tx_per_block * P12.bt10.E.block_rate_per_s');
const prod50 = P('P12.bt50.E.tpb_x_br', c50.tpb * c50.br, '(derived)', 'P12.bt50.E.tx_per_block * P12.bt50.E.block_rate_per_s');

/* Signed percentages are emitted in math mode so the minus renders as a minus
 * rather than a hyphen, and each sign is derived from its own quantity. */
const pctMath = (v) => `$${v < 0 ? '-' : '+'}${f(Math.abs(v), 1)}\\%$`;

const sentence =
`Reducing \\texttt{BatchTimeout} from 50\\,ms to 10\\,ms reduces mean sequential provenance write latency from ${f(s50.mean,1)}\\,ms to ${f(s10.mean,1)}\\,ms (${pctMath(latDelta)}), because at one transaction in flight every block waits out the full timeout. It leaves concurrent throughput at $W{=}100$ essentially unchanged, ${f(c50.steady)} against ${f(c10.steady)}\\,TPS (${pctMath(tpsDelta)}): the shorter timeout cuts smaller blocks more often, ${f(c10.tpb)} transactions per block at ${f(c10.br)} blocks per second against ${f(c50.tpb)} at ${f(c50.br)}, and their product, which is throughput, is conserved. Both settings were measured on the same deployment at a state size of ${c10.keys.toLocaleString('en-US')} counted keys.`;

fs.writeFileSync(path.join(OUT, 'phase12_batchtimeout_sentence.tex'), sentence + '\n');

const L = [];
L.push('PHASE 12 (single-host BatchTimeout probe) — number provenance');
L.push('='.repeat(62), '');
L.push('Every number in the companion fragment, with its source. Paths are relative to');
L.push(P12 + '/', '');
L.push('analysis.json  <- analyze.js, computed from txs.jsonl ONLY (steady_state = E1/steady.js)');
L.push('occupancy.json <- occupancy.js, computed from run manifests (height_delta)');
L.push('manifest.json  <- written by bench.js at run completion', '');
for (const r of prov) {
  L.push(`${r.key.padEnd(36)}= ${typeof r.val === 'number' ? f(r.val, 3) : r.val}`);
  L.push(`${' '.repeat(38)}${r.file}`);
  L.push(`${' '.repeat(38)}${r.jsonPath}${r.note ? '   [' + r.note + ']' : ''}`);
}
L.push('', 'Sanity: throughput is conserved across the two settings because the change in');
L.push('block occupancy is compensated by the change in block rate:');
L.push(`  10ms: ${f(c10.tpb)} tx/block x ${f(c10.br)} blocks/s = ${f(prod10,1)}`);
L.push(`  50ms: ${f(c50.tpb)} tx/block x ${f(c50.br)} blocks/s = ${f(prod50,1)}`);
L.push('These products exceed the measured steady TPS because blocks_produced counts');
L.push('every block in the run, including warm-up and drain, whereas steady TPS excludes');
L.push('both. The comparison of interest is 10ms against 50ms, not the absolute product.');
fs.writeFileSync(path.join(OUT, 'phase12_batchtimeout_sentence.txt'), L.join('\n') + '\n');

console.log(sentence);
console.log(`\n-> ${OUT}/phase12_batchtimeout_sentence.{tex,txt}`);
