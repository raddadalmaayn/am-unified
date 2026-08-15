'use strict';
/*
 * steady.js — THE single implementation of the steady-state window (amendment E1,
 * 2026-08-11). Every consumer imports this. There is no second definition.
 *
 * DEFINITION. The steady interval is the period during which exactly W
 * transactions were in flight throughout. Derived from txs.jsonl alone:
 *
 *   t_start = max(t_committed_ns) over records with warmup == true
 *   drain   = records with seq >= (total - W)
 *   t_end   = min(t_committed_ns) over drain
 *   count   = committed records with t_start < t_committed_ns <= t_end
 *   steady_tps = count / (t_end - t_start)
 *
 * W and total are themselves derived from the log, so nothing outside txs.jsonl
 * is consulted: total = max(seq)+1, W = number of distinct worker_slot values.
 *
 * WHY A THIRD DEFINITION. Two were previously in circulation and both are wrong:
 *   - the run manifest's steady_count / steady_duration_ms counts every
 *     non-warm-up transaction, including drain transactions that resolve after
 *     the in-flight count has already fallen below W, over a window many of them
 *     fall outside;
 *   - the earlier analyze.js figure dropped the trailing W completions but opened
 *     the window at the first non-warm-up record rather than at the moment the
 *     last warm-up transaction resolved, so it opened too early.
 * Both are reported alongside the corrected figure wherever a correction note is
 * emitted, rather than being silently replaced.
 *
 * Every returned object carries t_start, t_end, duration and count so the
 * division can be checked by hand.
 */
const fs = require('fs');

function computeSteady(jsonlPath) {
  const recs = fs.readFileSync(jsonlPath, 'utf8').split('\n')
    .filter(Boolean).map((l) => JSON.parse(l));
  if (!recs.length) return null;

  const total = Math.max(...recs.map((r) => r.seq)) + 1;
  const W = new Set(recs.map((r) => r.worker_slot)).size;

  const ts = (r) => (r.t_committed_ns == null ? null : BigInt(r.t_committed_ns));

  const warm = recs.filter((r) => r.warmup === true && r.t_committed_ns != null);
  if (!warm.length) return null;
  let tStart = ts(warm[0]);
  for (const r of warm) { const v = ts(r); if (v > tStart) tStart = v; }

  const drain = recs.filter((r) => r.seq >= (total - W) && r.t_committed_ns != null);
  if (!drain.length) return null;
  let tEnd = ts(drain[0]);
  for (const r of drain) { const v = ts(r); if (v < tEnd) tEnd = v; }

  if (tEnd <= tStart) {
    return { W, total, t_start_ns: tStart.toString(), t_end_ns: tEnd.toString(),
             duration_s: 0, count: 0, steady_tps: null,
             note: 'degenerate window: t_end <= t_start (drain begins before warm-up ends)' };
  }

  const count = recs.filter((r) => r.status === 'COMMITTED' && r.t_committed_ns != null &&
                                   ts(r) > tStart && ts(r) <= tEnd).length;
  const durationS = Number(tEnd - tStart) / 1e9;

  return {
    W, total,
    t_start_ns: tStart.toString(), t_end_ns: tEnd.toString(),
    duration_s: durationS, count,
    steady_tps: durationS > 0 ? count / durationS : null,
  };
}

/* Whole-run throughput, the basis that block_rate x tx_per_block actually
 * closes against (amendment E2). committed / (last committed - first committed)
 * across the entire run, warm-up and drain included, because height_delta counts
 * every block the run produced. */
function computeTotalWindow(jsonlPath) {
  const recs = fs.readFileSync(jsonlPath, 'utf8').split('\n')
    .filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.status === 'COMMITTED' && r.t_committed_ns != null);
  if (recs.length < 2) return null;
  const v = recs.map((r) => BigInt(r.t_committed_ns)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const durationS = Number(v[v.length - 1] - v[0]) / 1e9;
  return { committed: recs.length, duration_s: durationS,
           total_window_tps: durationS > 0 ? recs.length / durationS : null };
}

/* The manifest figure, reproduced for the correction note only. Never used as a
 * reported result. */
function manifestSteady(manifestPath) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const c = m.counts, t = m.timing;
  const n = (c.steady_count != null ? c.steady_count : c.committed);
  const d = t.steady_duration_ms / 1000;
  return { count: n, duration_s: d, steady_tps: d > 0 ? n / d : null };
}

module.exports = { computeSteady, computeTotalWindow, manifestSteady };
