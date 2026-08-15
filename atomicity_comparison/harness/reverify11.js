'use strict';
/*
 * reverify11.js — recompute the three-key classification for an ALREADY
 * COMPLETED run11.js run, using the corrected accumulator predicate.
 *
 * WHY THIS IS SOUND. The three keys are ledger state, which persists. Every
 * trial's opId and ratedActor were recorded in result.json. Re-walking the
 * ledger for those identifiers therefore yields exactly what the original walk
 * would have yielded had the predicate been right, without re-running the
 * trials. The fault injection is not repeated and does not need to be: the
 * writes it did or did not produce are already on the ledger.
 *
 * The original result.json is preserved as result_ORIGINAL_BUGGY.json and the
 * corrected output written to result.json, with a provenance block recording
 * the change. Nothing is deleted.
 *
 * Usage: reverify11.js <run_dir> [<run_dir> ...]
 */
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

function wilsonUpper(k, n, z = 1.96) {
  if (n === 0) return null;
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return ((c + s) / d) * 100;
}

async function main() {
  const dirs = process.argv.slice(2);
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const integ = net.getContract(chaincodeName, 'IntegrationContract');
  const rep = net.getContract(chaincodeName, 'ReputationContract');

  for (const d of dirs) {
    const rp = path.join(d, 'result.json');
    if (!fs.existsSync(rp)) { console.log(`skip ${d}: no result.json`); continue; }
    const j = JSON.parse(fs.readFileSync(rp, 'utf8'));
    const DIM = j.dim || 'quality';
    const before = JSON.stringify(j.summary);

    const recs = [];
    for (const op of j.records) {
      let evPresent = false, linkPresent = false, accPresent = false;
      try {
        const raw = await integ.evaluateTransaction('GetPartTrustReport', op.opId);
        const r = JSON.parse(dec.decode(raw));
        evPresent   = Array.isArray(r.provenanceHistory) && r.provenanceHistory.length > 0;
        linkPresent = Array.isArray(r.linkedRatings) && r.linkedRatings.length > 0;
      } catch { /* asset absent */ }
      try {
        const raw = await rep.evaluateTransaction('GetReputation', op.ratedActor, DIM);
        const s = JSON.parse(dec.decode(raw));
        accPresent = !!(s && s.totalEvents > 0);   // corrected predicate
      } catch { /* absent */ }
      const n = [evPresent, linkPresent, accPresent].filter(Boolean).length;
      const cls = n === 0 ? 'NEITHER' : n === 3 ? 'ALL_THREE' : 'PARTIAL';
      recs.push({ ...op, evPresent, linkPresent, accPresent, cls });
    }

    const summary = {};
    for (const r of recs) summary[r.cls] = (summary[r.cls] || 0) + 1;
    const partial = recs.filter((r) => r.cls === 'PARTIAL');

    if (!fs.existsSync(path.join(d, 'result_ORIGINAL_BUGGY.json'))) {
      fs.copyFileSync(rp, path.join(d, 'result_ORIGINAL_BUGGY.json'));
    }
    j._reverified = {
      at: new Date().toISOString(),
      reason: 'accumulator predicate corrected: GetReputation synthesises {alpha:2,beta:2,totalEvents:0} ' +
              'for never-rated actors, so (alpha>1||beta>1) was always true. Now totalEvents>0.',
      summary_before: before, summary_after: JSON.stringify(summary),
      original_preserved_as: 'result_ORIGINAL_BUGGY.json',
    };
    j.records = recs;
    j.summary = summary;
    j.divergences = partial.length;
    j.divergence_rate_pct = (partial.length / j.n) * 100;
    j.wilson95_upper_pct = wilsonUpper(partial.length, j.n);
    j.partial_detail = partial.slice(0, 20);
    fs.writeFileSync(rp, JSON.stringify(j, null, 2));

    console.log(`${path.basename(d).slice(4, 42).padEnd(42)} before=${before}  ->  after=${JSON.stringify(summary)}  ` +
                `PARTIAL=${partial.length} wilson95upper=${j.wilson95_upper_pct.toFixed(4)}%`);
  }
  gw.close(); client.close();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
