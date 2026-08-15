'use strict';
/*
 * reverify_d4.js — D2 cross-arm predicate check (2026-08-11).
 *
 * WHY THIS EXISTS. The Design A control (run_D4_A_window_seq) and the Design B
 * conditions (run11.js) were classified by DIFFERENT presence predicates:
 *
 *   Design A (run.js:154-165, MODE==='twotx'):
 *       provenance  <- LEDGER   prov:ReadAsset(opId) succeeds
 *       reputation  <- MARKERS  op.markers.includes('REP_COMMITTED' / 'REP_SUBMIT')
 *       DIVERGENT   =  provOnChain && rep provably never submitted
 *
 *   Design B (run11.js:112-148):
 *       all three keys <- LEDGER, "never from a marker"
 *       accumulator presence = GetReputation(actor, dim).totalEvents > 0
 *       PARTIAL (divergence) = any proper subset of the three present
 *
 * A 100% vs 0% contrast measured with two rulers is not a contrast. This script
 * re-classifies the Design A arm using the LEDGER on both halves, so both arms
 * are judged by the same rule.
 *
 * THE SHARED-ACTOR LIMITATION, STATED PLAINLY. run.js drives every trial in a
 * run against ONE rated actor (--rated=d4_aws); run11.js uses a per-trial actor
 * (`${opId}-actor`). GetRatingHistory, which would give per-trial rating lookup
 * by evidence=opId, requires CouchDB rich queries and this deployment is on
 * LevelDB. So the reputation half of Design A can only be read in AGGREGATE:
 * totalEvents over the shared accumulator. That is sound but weaker --
 * totalEvents == 0 proves no rating committed in ANY trial, which entails
 * reputation-absent for every trial individually; it could not localise a
 * partial. The provenance half is read per trial.
 *
 * A per-trial-actor Design A re-run is required for full symmetry and is done
 * separately (W4).
 */
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const RUNDIR = process.argv[2];
const DIM = process.argv[3] || 'quality';
if (!RUNDIR) { console.error('usage: node reverify_d4.js <rundir> [dim]'); process.exit(1); }

async function main() {
  const src = JSON.parse(fs.readFileSync(path.join(RUNDIR, 'result.json'), 'utf8'));
  const rated = src.rated;
  console.log(`[d2] rundir=${path.basename(RUNDIR)} n=${src.n} rated=${rated} dim=${DIM}`);

  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const prov = net.getContract('prov');
  const rep = net.getContract('rep');

  // --- reputation half: aggregate, shared accumulator ---
  let acc = null;
  try {
    const raw = await rep.evaluateTransaction('GetReputation', rated, DIM);
    acc = JSON.parse(dec.decode(raw));
  } catch (e) { acc = { error: String(e.message).slice(0, 200) }; }
  const repPresent = !!(acc && acc.totalEvents > 0);
  console.log(`[d2] accumulator ${rated}/${DIM}: totalEvents=${acc && acc.totalEvents} ` +
              `alpha=${acc && acc.alpha} -> repPresent=${repPresent}`);

  // --- provenance half: per trial, from the ledger ---
  const out = [];
  let i = 0;
  for (const r of src.records) {
    let provPresent = false;
    try { await prov.evaluateTransaction('ReadAsset', r.opId); provPresent = true; }
    catch { /* absent */ }
    // Same rule as run11.js: a proper subset of the required keys is a divergence.
    const n = [provPresent, repPresent].filter(Boolean).length;
    const cls = n === 0 ? 'NEITHER' : n === 2 ? 'BOTH' : 'DIVERGENT';
    out.push({ opId: r.opId, killed: r.killed, provPresent, repPresent,
               cls_ledger: cls, cls_original: r.cls, agrees: (cls === 'DIVERGENT') === (r.cls === 'DIVERGENT') });
    if (++i % 100 === 0) console.log(`[d2]   ${i}/${src.records.length}`);
  }
  gw.close(); client.close();

  const summary = {};
  for (const r of out) summary[r.cls_ledger] = (summary[r.cls_ledger] || 0) + 1;
  const disagree = out.filter((r) => !r.agrees);

  const result = {
    reverified_at: new Date().toISOString(),
    purpose: 'D2 cross-arm predicate check: re-classify Design A under the Design B (ledger-only) ruler',
    rundir: path.basename(RUNDIR), n: src.n, rated, dim: DIM,
    predicate_original: "run.js:154-165 — provenance from ledger (prov:ReadAsset); reputation from fsync'd markers (REP_COMMITTED/REP_SUBMIT); DIVERGENT = provOnChain && never_submitted",
    predicate_applied_here: 'ledger on both halves — prov:ReadAsset per trial; rep:GetReputation(rated,dim).totalEvents>0 in aggregate (shared accumulator)',
    accumulator_read: acc,
    rep_present: repPresent,
    summary_ledger: summary,
    summary_original: src.summary,
    disagreements: disagree.length,
    disagreement_detail: disagree.slice(0, 20),
    shared_actor_caveat: 'run.js uses one rated actor per run; GetRatingHistory needs CouchDB (LevelDB here). Reputation half is therefore aggregate, not per-trial. totalEvents==0 entails reputation-absent for every trial.',
    records: out,
  };
  fs.writeFileSync(path.join(RUNDIR, 'result_D2_LEDGER_REVERIFY.json'), JSON.stringify(result, null, 2));
  console.log(`[d2] ledger summary=${JSON.stringify(summary)} original=${JSON.stringify(src.summary)}`);
  console.log(`[d2] disagreements=${disagree.length} -> ${RUNDIR}/result_D2_LEDGER_REVERIFY.json`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
