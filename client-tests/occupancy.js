'use strict';
/**
 * occupancy.js — block occupancy per condition.
 *
 * Unlike analyze.js (JSONL-only by design), this tool needs BOTH sources:
 *   - manifest.json : height_delta per peer, from peer channel getinfo before/after
 *   - txs.jsonl     : committed count and the steady-state window
 * It is kept separate precisely so analyze.js stays pure.
 *
 * HYPOTHESIS UNDER TEST (stated before the data was seen):
 *   Under smooth pipelined arrivals the orderer cuts blocks on BatchTimeout=50ms
 *   rather than MaxMessageCount=10, so blocks carry roughly one transaction and
 *   throughput is limited by BLOCK RATE, not transaction rate. The old wave-barrier
 *   harness produced bursty arrivals that filled blocks toward ten, which is why it
 *   reported ~30 TPS. If E at W=20 returns tx_per_block near 0.6 and block_rate
 *   near 20/s, the hypothesis holds.
 *
 * Nothing here is adjusted to fit that. The numbers are reported either way.
 *
 * A NOTE ON block_rate_per_s, stated openly:
 *   blocks_produced is measured across the WHOLE run (getinfo before -> after),
 *   while steady_window_s covers only the steady-state subset. Dividing one by the
 *   other therefore OVERSTATES the true steady-state block rate, because warm-up
 *   and drain blocks are counted against a shorter window. Both the requested
 *   figure and a total-window figure are reported so the difference is visible.
 *
 * Usage: node occupancy.js <resultsRoot>
 */

const fs   = require('fs');
const path = require('path');

function findRuns(root) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'manifest.json') {
        const j = path.join(d, 'txs.jsonl');
        if (fs.existsSync(j)) out.push({ manifest: p, jsonl: j });
      }
    }
  })(root);
  return out.sort();
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function analyseRun({ manifest, jsonl }) {
  const man = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const recs = fs.readFileSync(jsonl, 'utf8').split('\n')
    .filter(Boolean).map(l => JSON.parse(l));

  const committed = recs.filter(r => r.status === 'COMMITTED').length;

  // blocks_produced from org1, with agreement across all four confirmed.
  const hd = man.height_delta || {};
  // Topology comes from the run's own height_delta, not a constant. The lab has
  // four peer orgs and the single-host testbed has two; hardcoding four made
  // every single-host run report "4-peer agree: NO" when all peers in fact
  // agreed on height and hash.
  const orgs = Object.keys(hd).length ? Object.keys(hd) : ['org1'];
  const deltas = orgs.map(o => hd[o]);
  const allAgree = deltas.every(d => typeof d === 'number') &&
                   new Set(deltas).size === 1;
  const blocks = hd.org1;

  // MaxMessageCount as actually configured for this run. The single-host
  // manifests carry an error here because decodedChannelParams() uses
  // lab-only paths, so --mmc supplies it from the independently verified
  // channel decode rather than a guess.
  const cp = man.channel_params || {};
  const mmcRun = (cp.batch_size && cp.batch_size.max_message_count) || null;

  // Steady window recomputed from the JSONL, matching analyze.js: steady
  // committed records sorted by commit time, trailing `slots` dropped.
  const steady = recs.filter(r => r.status === 'COMMITTED' && !r.warmup && r.t_committed_ns);
  const slots = new Set(recs.map(r => r.worker_slot)).size;
  const sorted = steady.sort((a, b) => {
    const x = BigInt(a.t_committed_ns), y = BigInt(b.t_committed_ns);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const retained = sorted.slice(0, Math.max(0, sorted.length - Math.min(slots, sorted.length)));
  let steadyWindowS = null, steadyTps = null;
  if (retained.length >= 2) {
    const ms = Number(BigInt(retained[retained.length - 1].t_committed_ns) -
                      BigInt(retained[0].t_committed_ns)) / 1e6;
    steadyWindowS = ms / 1000;
    steadyTps = steadyWindowS > 0 ? (retained.length - 1) / steadyWindowS : null;
  }

  const totalWindowS = man.timing && man.timing.total_duration_ms
    ? man.timing.total_duration_ms / 1000 : null;

  const txPerBlock   = (blocks > 0) ? committed / blocks : null;
  const blockRate    = (blocks > 0 && steadyWindowS > 0) ? blocks / steadyWindowS : null;
  const blockRateTot = (blocks > 0 && totalWindowS > 0)  ? blocks / totalWindowS  : null;

  return {
    max_message_count: mmcRun,
    condition: man.condition, run_index: man.run_index, W: man.condition_params.W,
    n: man.condition_params.total, committed,
    blocks_produced: blocks, height_delta_all_agree: allAgree, height_deltas: hd,
    tx_per_block: txPerBlock,
    steady_window_s: steadyWindowS,
    block_rate_per_s: blockRate,
    total_window_s: totalWindowS,
    block_rate_per_s_total_window: blockRateTot,
    steady_tps: steadyTps,
    p50_ms: median(retained.map(r => r.latency_total_ms).filter(v => typeof v === 'number')),
    endorse_median_ms: median(retained.map(r => r.latency_endorse_ms).filter(v => typeof v === 'number')),
    order_commit_median_ms: median(retained.map(r => r.latency_order_commit_ms).filter(v => typeof v === 'number')),
    convergence: man.ledger_convergence || null,
  };
}

function f(v, d = 2) { return v == null ? 'n/a' : Number(v).toFixed(d); }

function main() {
  const root = process.argv[2];
  // --mmc=<n>: MaxMessageCount for testbeds whose manifests could not record
  // the decoded channel config. Supplied from an independently verified decode.
  let MMC_CLI = null;
  for (const a of process.argv.slice(3)) {
    if (a.startsWith('--mmc=')) MMC_CLI = parseInt(a.split('=')[1], 10);
  }
  if (!root) { console.error('usage: node occupancy.js <resultsRoot>'); process.exit(2); }
  const runs = findRuns(root).map(analyseRun);
  if (!runs.length) { console.error('no runs found'); process.exit(1); }

  const byCond = {};
  for (const r of runs) (byCond[r.condition] = byCond[r.condition] || []).push(r);

  const L = [];
  L.push('## Block occupancy per condition');
  L.push('');
  L.push('`blocks_produced` = height_delta(org1); agreement across all four peers confirmed per run.');
  L.push('`tx_per_block` = committed / blocks_produced. `block_rate_per_s` = blocks_produced / steady_window_s.');
  L.push('');
  L.push('| Cond | W | n | Committed | Blocks | tx/block | Block rate /s | Steady TPS | P50 ms | Endorse ms | Ord+Commit ms | 4-peer agree |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.keys(byCond).sort()) {
    for (const r of byCond[c].sort((a, b) => a.run_index - b.run_index)) {
      L.push(`| ${r.condition} r${r.run_index} | ${r.W} | ${r.n} | ${r.committed} | ${r.blocks_produced} | ` +
             `${f(r.tx_per_block)} | ${f(r.block_rate_per_s)} | ${f(r.steady_tps)} | ${f(r.p50_ms, 1)} | ` +
             `${f(r.endorse_median_ms, 1)} | ${f(r.order_commit_median_ms, 1)} | ${r.height_delta_all_agree ? 'yes' : 'NO'} |`);
    }
  }
  L.push('');
  L.push('### Median across runs, per condition');
  L.push('');
  L.push('| Cond | W | tx/block | Block rate /s (steady win) | Block rate /s (total win) | Steady TPS | P50 ms |');
  L.push('|---|---|---|---|---|---|---|');
  for (const c of Object.keys(byCond).sort()) {
    const rs = byCond[c];
    L.push(`| ${c} | ${rs[0].W} | ${f(median(rs.map(r => r.tx_per_block).filter(v => v != null)))} | ` +
           `${f(median(rs.map(r => r.block_rate_per_s).filter(v => v != null)))} | ` +
           `${f(median(rs.map(r => r.block_rate_per_s_total_window).filter(v => v != null)))} | ` +
           `${f(median(rs.map(r => r.steady_tps).filter(v => v != null)))} | ` +
           `${f(median(rs.map(r => r.p50_ms).filter(v => v != null)), 1)} |`);
  }

  // ── hypothesis verdict, computed, not asserted ────────────────────────────
  L.push('');
  L.push('### Hypothesis verdict');
  L.push('');
  const E = byCond['E'];
  if (E && E.length) {
    const tpb = median(E.map(r => r.tx_per_block).filter(v => v != null));
    const br  = median(E.map(r => r.block_rate_per_s).filter(v => v != null));
    L.push(`Condition E (W=${E[0].W}), median tx_per_block = **${f(tpb)}**, median block_rate = **${f(br)}/s**.`);
    const nearOne = tpb != null && tpb < 2;
    L.push('');
    L.push(`- Blocks carry roughly one transaction (tx_per_block < 2): **${nearOne ? 'YES' : 'NO'}**`);
    L.push(`- Predicted shape was tx_per_block near 0.6 and block_rate near 20/s.`);
    // MaxMessageCount comes from the channel config in the manifest where
    // available. It is 10 on the lab and 100 on the single-host network, so a
    // hardcoded 10 misstates single-host occupancy by an order of magnitude.
    const mmc = MMC_CLI != null ? MMC_CLI : (E[0] && E[0].max_message_count) || null;
    L.push(`- MaxMessageCount = ${mmc == null ? 'UNKNOWN (not recorded in manifest)' : mmc}` +
           `; occupancy ${tpb != null && mmc ? (tpb / mmc * 100).toFixed(1) + '% of budget' : 'n/a'}` +
           `; blocks are ${tpb != null && mmc != null && tpb >= 0.8 * mmc ? 'FILLING' : 'NOT filling'}.`);
    L.push('');
    if (tpb != null && tpb >= 8) {
      L.push('**MaxMessageCount IS binding.** Phase 7b is warranted.');
    } else {
      L.push('**MaxMessageCount is NOT binding**, so raising it cannot raise throughput. ' +
             'Per the revised Phase 7, 7b is skipped unless some BatchTimeout setting in 7a drives tx_per_block to 8 or above.');
    }
  } else {
    L.push('Condition E not present in this dataset.');
  }

  // ── convergence laggard tracking (testbed heterogeneity disclosure) ───────
  L.push('');
  L.push('### Ledger convergence per run');
  L.push('');
  L.push('| Cond | Run | Converged | wait_ms | polls |');
  L.push('|---|---|---|---|---|');
  for (const c of Object.keys(byCond).sort()) {
    for (const r of byCond[c].sort((a, b) => a.run_index - b.run_index)) {
      const cv = r.convergence || {};
      L.push(`| ${r.condition} | ${r.run_index} | ${cv.converged === undefined ? 'n/a' : cv.converged} | ${cv.wait_ms != null ? cv.wait_ms : 'n/a'} | ${cv.polls != null ? cv.polls : 'n/a'} |`);
    }
  }

  const md = L.join('\n');
  fs.writeFileSync(path.join(root, 'occupancy.md'), md);
  fs.writeFileSync(path.join(root, 'occupancy.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    note: 'blocks_produced spans the whole run; steady_window_s is a subset, so block_rate_per_s over the steady window overstates. Total-window figure reported alongside.',
    runs,
  }, null, 2));
  console.log(md);
  console.log(`\nwrote ${path.join(root, 'occupancy.md')}`);
}

main();
