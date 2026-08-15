'use strict';
/*
 * emit_latex_resources.js — Section 5.5.3 resource-utilisation fragment.
 *
 * Reads the per-node resource samplers' raw CSV from Phase 3B and Phase 4 and
 * the run manifests that define the load windows. NO NUMBER IS TYPED BY HAND.
 *
 * Container classes, because the manuscript's single "all peers" figure hides
 * the distinction that matters:
 *   client      HARNESS_bench.js on D1 (SDK, not a network component)
 *   chaincode   cc-unified on each node
 *   peer        peer0.org{1..4}
 *   leader      the Raft leader's orderer  (orderer.example.com, D4)
 *   follower    orderer2 (D2), orderer3 (D3)
 *
 * A sample is LOAD if its timestamp falls inside any run's
 * [wall_clock_start, wall_clock_end]; otherwise IDLE. Cooldowns and the gaps
 * between conditions are therefore idle, which is what "idle baseline" means
 * here. CPU% is normalised so 100% = one saturated core.
 *
 * Usage: node emit_latex_resources.js [outdir]
 */
const fs = require('fs');
const path = require('path');

const R = 'am-unified/results';
const OUT = process.argv[2] || path.join(R, 'latex_fragments');
fs.mkdirSync(OUT, { recursive: true });

const PHASES = [
  { tag: 'phase3b', dir: fs.readdirSync(R).find((d) => d.startsWith('phase3b-')) },
  { tag: 'phase4', dir: fs.readdirSync(R).find((d) => d.startsWith('phase4-')) },
];

function walkManifests(root, acc) {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) walkManifests(p, acc);
    else if (e.name === 'manifest.json') {
      try {
        const m = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (m.wall_clock_start && m.wall_clock_end)
          acc.push([Date.parse(m.wall_clock_start), Date.parse(m.wall_clock_end), p]);
      } catch { /* unreadable manifest is not a window */ }
    }
  }
  return acc;
}

function classOf(container) {
  if (container.startsWith('HARNESS')) return 'client';
  if (container.startsWith('cc-')) return 'chaincode';
  if (container.startsWith('peer0')) return 'peer';
  if (container === 'orderer.example.com') return 'leader';
  if (container.startsWith('orderer')) return 'follower';
  return null;
}

const pct = (v, p) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const med = (v) => pct(v, 50);
const f = (v, d = 1) => (v == null ? 'n/a' : Number(v).toFixed(d));

// ── collect ────────────────────────────────────────────────────────────────
const bucket = {};   // class -> {idle:{cpu:[],mem:[]}, load:{cpu:[],mem:[]}}
const leaderSeries = [];
let totalRows = 0, manifestCount = 0;
const sources = [];

for (const ph of PHASES) {
  if (!ph.dir) continue;
  const base = path.join(R, ph.dir);
  const csv = path.join(base, 'resources.csv');
  if (!fs.existsSync(csv)) continue;
  const windows = walkManifests(base, []);
  manifestCount += windows.length;
  sources.push({ phase: ph.tag, csv, windows: windows.length });
  const lines = fs.readFileSync(csv, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const L = lines[i];
    if (!L) continue;
    const c = L.split(',');
    if (c.length < 10) continue;
    const t = Date.parse(c[0]), container = c[2];
    const cls = classOf(container);
    if (!cls) continue;
    totalRows++;
    const cpu = c[3] === 'NA' ? null : parseFloat(c[3]);
    const mem = parseFloat(c[4]);
    const load = windows.some(([s, e]) => t >= s && t <= e);
    const b = (bucket[cls] = bucket[cls] || { idle: { cpu: [], mem: [] }, load: { cpu: [], mem: [] } });
    const k = load ? 'load' : 'idle';
    if (cpu != null && Number.isFinite(cpu)) b[k].cpu.push(cpu);
    if (Number.isFinite(mem)) b[k].mem.push(mem);
    if (cls === 'leader' && Number.isFinite(mem)) leaderSeries.push([t, mem, ph.tag]);
  }
}

// ── leader drift: first vs last decile of the session, per phase ───────────
leaderSeries.sort((a, b) => a[0] - b[0]);
const drift = {};
for (const ph of PHASES.map((p) => p.tag)) {
  const s = leaderSeries.filter((x) => x[2] === ph);
  if (s.length < 20) continue;
  const k = Math.max(1, Math.floor(s.length / 10));
  drift[ph] = {
    n: s.length,
    first_decile_med: med(s.slice(0, k).map((x) => x[1])),
    last_decile_med: med(s.slice(-k).map((x) => x[1])),
    span_min: (s[s.length - 1][0] - s[0][0]) / 60000,
    min: Math.min(...s.map((x) => x[1])),
    max: Math.max(...s.map((x) => x[1])),
  };
}

// ── provenance ─────────────────────────────────────────────────────────────
const prov = [];
const P = (key, val, src, how, note) => { prov.push({ key, val, src, how, note }); return val; };

const ORDER = [
  ['client', 'Client SDK (D1)'],
  ['chaincode', 'Chaincode (per node)'],
  ['peer', 'Peer (4 nodes)'],
  ['follower', 'Orderer, follower (2)'],
  ['leader', 'Orderer, Raft leader'],
];

const rows = [];
for (const [cls, label] of ORDER) {
  const b = bucket[cls];
  if (!b) continue;
  const v = {
    idleCpu: P(`R.${cls}.idle_cpu_median`, med(b.idle.cpu), 'resources.csv', `median cpu_pct, samples outside every run window (n=${b.idle.cpu.length})`),
    idleMem: P(`R.${cls}.idle_mem_median_mb`, med(b.idle.mem), 'resources.csv', `median mem_used_mb, idle (n=${b.idle.mem.length})`),
    cpuMed: P(`R.${cls}.load_cpu_median`, med(b.load.cpu), 'resources.csv', `median cpu_pct, samples inside a run window (n=${b.load.cpu.length})`),
    cpuP95: P(`R.${cls}.load_cpu_p95`, pct(b.load.cpu, 95), 'resources.csv', 'p95 cpu_pct under load'),
    cpuMax: P(`R.${cls}.load_cpu_peak`, b.load.cpu.length ? Math.max(...b.load.cpu) : null, 'resources.csv', 'max cpu_pct under load'),
    memMed: P(`R.${cls}.load_mem_median_mb`, med(b.load.mem), 'resources.csv', `median mem_used_mb under load (n=${b.load.mem.length})`),
    memP95: P(`R.${cls}.load_mem_p95_mb`, pct(b.load.mem, 95), 'resources.csv', 'p95 mem_used_mb under load'),
    memMax: P(`R.${cls}.load_mem_peak_mb`, b.load.mem.length ? Math.max(...b.load.mem) : null, 'resources.csv', 'max mem_used_mb under load'),
  };
  rows.push(`${label} & ${f(v.idleCpu)} & ${f(v.cpuMed)} & ${f(v.cpuP95)} & ${f(v.cpuMax)} & ` +
            `${f(v.idleMem, 0)} & ${f(v.memMed, 0)} & ${f(v.memP95, 0)} & ${f(v.memMax, 0)} \\\\`);
}

for (const [ph, d] of Object.entries(drift)) {
  P(`R.leader.drift.${ph}.first_decile_med_mb`, d.first_decile_med, 'resources.csv', `median mem_used_mb, first 10% of ${ph} samples`);
  P(`R.leader.drift.${ph}.last_decile_med_mb`, d.last_decile_med, 'resources.csv', `median mem_used_mb, last 10% of ${ph} samples`);
  P(`R.leader.drift.${ph}.span_min`, d.span_min, 'resources.csv', `session span in minutes (${d.n} samples)`);
}

fs.writeFileSync(path.join(OUT, 'resources_body.tex'), rows.join('\n') + '\n');

const L = [];
L.push('SECTION 5.5.3 resource utilisation — number provenance');
L.push('='.repeat(56), '');
L.push('Source: the per-node resource samplers, read from cgroup v2 every 2 s.');
for (const s of sources) L.push(`  ${s.phase}: ${s.csv}  (${s.windows} run windows from manifests)`);
L.push('', `Rows classified: ${totalRows}. Load = timestamp inside a run's`);
L.push("[wall_clock_start, wall_clock_end]; idle = every other sample.");
L.push('CPU% is normalised so that 100% = one saturated core.', '');
for (const r of prov) {
  L.push(`${r.key.padEnd(38)}= ${typeof r.val === 'number' ? f(r.val, 2) : r.val}`);
  L.push(`${' '.repeat(40)}${r.src}`);
  L.push(`${' '.repeat(40)}${r.how}${r.note ? '   [' + r.note + ']' : ''}`);
}
L.push('', 'Raft leader memory drift, reported as an observation not a diagnosis:');
for (const [ph, d] of Object.entries(drift)) {
  L.push(`  ${ph}: ${f(d.first_decile_med, 0)} MB -> ${f(d.last_decile_med, 0)} MB over ${f(d.span_min, 0)} min ` +
         `(min ${f(d.min, 0)}, max ${f(d.max, 0)}, n=${d.n})`);
}
fs.writeFileSync(path.join(OUT, 'resources_body.txt'), L.join('\n') + '\n');

console.log(rows.join('\n'));
console.log('\ndrift:', JSON.stringify(drift, null, 1));
console.log(`\n-> ${OUT}/resources_body.{tex,txt}`);
