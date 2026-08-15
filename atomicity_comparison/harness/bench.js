'use strict';
/*
 * bench.js — Phase 2 baseline (NO faults). Same workload for both designs.
 *   sequential : N logical ops one-at-a-time -> end-to-end latency mean/p50/p95
 *   concurrent : N logical ops at concurrency C -> wall-clock TPS + MVCC rate
 *
 * A "logical op" =
 *   twotx   : CreateMaterialCertification (tx1) + SubmitRating (tx2)  [2 invokes]
 *   unified : RecordProvenanceWithReputation                          [1 invoke]
 *
 * Usage: node bench.js --mode=twotx|unified --n=200 --conc=20 --rated=supplier_b
 */
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

function arg(name, def) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : def;
}
const MODE  = arg('mode', 'twotx');
const N     = parseInt(arg('n', '200'), 10);
const CONC  = parseInt(arg('conc', '20'), 10);
const RATED = arg('rated', 'supplier_bench');
const INVOKES = MODE === 'twotx' ? 2 : 1;

let _c = 0;
const uid = () => `${MODE}-b-${Date.now()}-${++_c}-${Math.random().toString(36).slice(2, 6)}`;

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))];
}

async function doOp(contracts, opId, actor) {
  if (MODE === 'twotx') {
    await contracts.prov.submitTransaction('CreateMaterialCertification', opId, 'Ti-6Al-4V', `batch-${opId}`, actor, `hash-${opId}`);
    const ts = Math.floor(Date.now() / 1000).toString();
    await contracts.rep.submitTransaction('SubmitRating', actor, 'quality', '0.9', opId, ts);
  } else {
    await contracts.integ.submitTransaction('RecordProvenanceWithReputation', opId, 'MATERIAL_CERTIFICATION', `hash-${opId}`, actor, '0.9', 'quality', opId);
  }
}

(async () => {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const contracts = {
    prov:  net.getContract('prov'),        // design A: separate chaincode
    rep:   net.getContract('rep'),         // design A: separate chaincode
    integ: net.getContract(chaincodeName, 'IntegrationContract'),
  };

  // ---- Sequential latency (distinct actor per op -> minimal contention) ----
  const lat = [];
  for (let i = 0; i < N; i++) {
    const t = Date.now();
    try { await doOp(contracts, uid(), `${RATED}_${i}`); lat.push(Date.now() - t); }
    catch (e) { /* skip on error */ }
  }
  const seq = {
    samples: lat.length,
    mean: lat.length ? (lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
    p50: pct(lat, 50), p95: pct(lat, 95),
  };

  // ---- Concurrent throughput + MVCC (distinct actor per op) ----
  let idx = 0, ok = 0, mvcc = 0, other = 0;
  const t0 = Date.now();
  async function lane() {
    while (idx < N) {
      const i = idx++;
      try { await doOp(contracts, uid(), `${RATED}_c_${i}`); ok++; }
      catch (e) {
        const m = (e.message || String(e));
        if (/MVCC|conflict|phantom/i.test(m)) mvcc++; else other++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => lane()));
  const wall = (Date.now() - t0) / 1000;
  const conc = {
    total: N, ok, mvcc, other,
    wall_s: wall, tps: ok / wall,
    mvcc_rate: (mvcc / N),
  };

  const out = { mode: MODE, n: N, conc_level: CONC, invokes_per_logical_tx: INVOKES, sequential: seq, concurrent: conc };
  console.log(JSON.stringify(out, null, 2));
  gw.close(); client.close();
})().catch((e) => { console.error('BENCH_FATAL', e); process.exit(1); });
