'use strict';
/*
 * lifecycle_assertion_test.js — measured correctness check for the lifecycle
 * state machine on the bridge path (Section 5 of the manuscript).
 *
 * WHAT IS TESTED. The unified chaincode constrains three lifecycle transitions:
 *
 *     PRINT_JOB      requires the asset to be at MATERIAL_CERTIFIED
 *     INSPECTION     requires the asset to be at PRINT_COMPLETE
 *     CERTIFICATION  requires the asset to be at INSPECTION_PASSED
 *
 * (MATERIAL_CERTIFICATION is the genesis event and instead requires that the
 * asset not yet exist.) Every one of these is submitted through the BRIDGE
 * entry point, IntegrationContract:RecordProvenanceWithReputation, because the
 * criticism this answers is that the bridge path might bypass the assertion the
 * direct provenance path enforces.
 *
 * DESIGN. For each constrained transition, N submissions are made against an
 * asset that is deliberately in the wrong stage:
 *
 *   PRINT_JOB      -> against an asset that does not exist          (stage "")
 *   INSPECTION     -> against an asset at MATERIAL_CERTIFIED
 *   CERTIFICATION  -> against an asset at MATERIAL_CERTIFIED
 *
 * Each submission uses a rated actor unique to itself, so the reputation half of
 * every trial is independently observable on the ledger.
 *
 * For every submission we record: whether it was rejected, the PHASE at which it
 * was rejected (endorse / submit / commit), and an error class. A chaincode
 * assertion fails during endorsement, so a correctly enforced assertion produces
 * a rejection at the endorse phase and no transaction ever reaches the orderer.
 *
 * LEDGER WALK. After the submissions, every trial is checked from the ledger
 * through read-only queries: no provenance event, no accumulator increment, and
 * no link entry may exist. Accumulator presence is tested on totalEvents,
 * because GetReputation synthesises {alpha:2,beta:2,totalEvents:0} for an actor
 * that has never been rated.
 *
 * CONTROL. N in-order operations, each creating an asset with
 * MATERIAL_CERTIFICATION and then advancing it with PRINT_JOB, must both commit.
 * Without this the rejection result would be consistent with a chaincode that
 * rejects everything.
 *
 * Usage: node lifecycle_assertion_test.js <outdir> [N]
 */
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } =
  require('atomicity_comparison/harness/lib.js');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const OUT = process.argv[2] || '/tmp';
const N = parseInt(process.argv[3] || '100', 10);
const RUN = `LCA-${Date.now().toString(36)}`;

/* Classify a gateway failure by phase and kind. The Fabric gateway surfaces a
 * chaincode-side rejection during endorsement as an EndorseError; anything that
 * fails later carries a different constructor. We record the constructor name
 * rather than pattern-matching the message, and keep the message separately. */
function classify(e) {
  const name = e && e.constructor ? e.constructor.name : 'Unknown';
  /* The gateway's own message is generic ("failed to endorse transaction");
   * the chaincode's error is carried in e.details[].message. We must read it,
   * otherwise "rejected" cannot be distinguished from "rejected for some other
   * reason", which is the whole point of the check. */
  let detailMsg = '';
  if (e && Array.isArray(e.details) && e.details.length) {
    detailMsg = e.details.map((d) => (d && d.message) || '').join(' | ');
  }
  const msg = String(detailMsg || (e && e.message) || e).replace(/\s+/g, ' ').slice(0, 400);
  let phase = 'unknown', cls = 'OTHER';
  if (name === 'EndorseError') { phase = 'endorse'; cls = 'CHAINCODE_REJECT'; }
  else if (name === 'SubmitError') { phase = 'submit'; cls = 'ORDERER_REJECT'; }
  else if (name === 'CommitStatusError' || name === 'CommitError') { phase = 'commit'; cls = 'VALIDATION_REJECT'; }
  else if (/DeadlineExceeded|UNAVAILABLE/i.test(msg)) { phase = 'transport'; cls = 'GATEWAY_UNAVAILABLE'; }
  if (/invalid lifecycle transition/i.test(msg)) cls = 'LIFECYCLE_ASSERTION';
  return { phase, cls, error_name: name, message: msg };
}

async function main() {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const integ = net.getContract(chaincodeName, 'IntegrationContract');
  const rep = net.getContract(chaincodeName, 'ReputationContract');

  const bridge = (assetID, evt, actor, dim) => integ.submitTransaction(
    'RecordProvenanceWithReputation', assetID, evt, `hash-${assetID}-${evt}`,
    actor, '0.9', dim, assetID);

  async function accEvents(actor, dim) {
    try {
      const raw = await rep.evaluateTransaction('GetReputation', actor, dim);
      const s = JSON.parse(dec.decode(raw));
      return (s && typeof s.totalEvents === 'number') ? s.totalEvents : null;
    } catch { return null; }
  }
  async function report(assetID) {
    try {
      const raw = await integ.evaluateTransaction('GetPartTrustReport', assetID);
      return JSON.parse(dec.decode(raw));
    } catch { return null; }
  }

  const out = { run_id: RUN, started_at: new Date().toISOString(), n_per_condition: N,
                channel: channelName, chaincode: chaincodeName, conditions: {}, control: {} };

  // ── out-of-order conditions ───────────────────────────────────────────────
  const CONDS = [
    { key: 'PRINT_JOB_on_absent_asset',
      evt: 'PRINT_JOB', dim: 'quality', requires: 'MATERIAL_CERTIFIED',
      setup: 'none (asset never created)', prepare: async () => null },
    { key: 'INSPECTION_on_material_certified',
      evt: 'INSPECTION', dim: 'quality', requires: 'PRINT_COMPLETE',
      setup: 'asset created with MATERIAL_CERTIFICATION',
      prepare: async (id, actor) => { await bridge(id, 'MATERIAL_CERTIFICATION', actor, 'compliance'); } },
    { key: 'CERTIFICATION_on_material_certified',
      evt: 'CERTIFICATION', dim: 'compliance', requires: 'INSPECTION_PASSED',
      setup: 'asset created with MATERIAL_CERTIFICATION',
      prepare: async (id, actor) => { await bridge(id, 'MATERIAL_CERTIFICATION', actor, 'compliance'); } },
  ];

  for (const c of CONDS) {
    const trials = [];
    process.stdout.write(`[lca] ${c.key}: `);
    for (let i = 0; i < N; i++) {
      const assetID = `${RUN}-${c.key}-${i}`;
      const actor = `${assetID}-actor`;
      let prepared = true;
      try { await c.prepare(assetID, `${assetID}-setupactor`); }
      catch (e) { prepared = false; }
      const before = await accEvents(actor, c.dim);
      let rejected = false, detail = null;
      try { await bridge(assetID, c.evt, actor, c.dim); }
      catch (e) { rejected = true; detail = classify(e); }
      trials.push({ i, assetID, actor, prepared, rejected, ...(detail || {}), acc_before: before });
      if ((i + 1) % 25 === 0) process.stdout.write('.');
    }
    process.stdout.write('\n');

    // ledger walk
    let evWritten = 0, accChanged = 0, linkWritten = 0, assetAtWrongStage = 0;
    for (const t of trials) {
      const r = await report(t.assetID);
      const after = await accEvents(t.actor, c.dim);
      t.acc_after = after;
      // provenance: does an event of the rejected TYPE appear in the history?
      const hist = (r && Array.isArray(r.provenanceHistory)) ? r.provenanceHistory : [];
      const badEvent = hist.some((e) => (e.eventType || e.EventType) === c.evt);
      const links = (r && Array.isArray(r.linkedRatings)) ? r.linkedRatings : [];
      // link entries attributable to the rejected submission's rated actor
      const badLink = links.some((l) => (l.ratedActor || l.RatedActor) === t.actor);
      if (badEvent) evWritten++;
      if (after !== null && after > 0) accChanged++;
      if (badLink) linkWritten++;
      if (r && r.currentStage && c.requires && r.currentStage === c.requires) assetAtWrongStage++;
      t.event_written = badEvent; t.link_written = badLink;
      t.stage_after = r ? (r.currentStage || null) : null;
      t.history_len = hist.length;
    }

    const byCls = {}, byPhase = {};
    for (const t of trials) {
      if (!t.rejected) continue;
      byCls[t.cls] = (byCls[t.cls] || 0) + 1;
      byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
    }
    out.conditions[c.key] = {
      event_type: c.evt, dimension: c.dim, requires_stage: c.requires, setup: c.setup,
      n: N,
      rejected: trials.filter((t) => t.rejected).length,
      accepted: trials.filter((t) => !t.rejected).length,
      by_error_class: byCls, by_phase: byPhase,
      ledger_walk: {
        provenance_events_written: evWritten,
        accumulators_incremented: accChanged,
        link_entries_written: linkWritten,
      },
      trials,
    };
    const s = out.conditions[c.key];
    console.log(`[lca]   rejected ${s.rejected}/${N}, phases ${JSON.stringify(byPhase)}, ` +
                `classes ${JSON.stringify(byCls)}, ledger writes ` +
                `ev=${evWritten} acc=${accChanged} link=${linkWritten}`);
  }

  // ── control: in-order, must commit ────────────────────────────────────────
  process.stdout.write('[lca] CONTROL in-order: ');
  const ctrl = [];
  for (let i = 0; i < N; i++) {
    const assetID = `${RUN}-CTRL-${i}`;
    const a1 = `${assetID}-a1`, a2 = `${assetID}-a2`;
    const rec = { i, assetID, genesis_committed: false, transition_committed: false };
    try { await bridge(assetID, 'MATERIAL_CERTIFICATION', a1, 'compliance'); rec.genesis_committed = true; }
    catch (e) { rec.genesis_error = classify(e); }
    if (rec.genesis_committed) {
      try { await bridge(assetID, 'PRINT_JOB', a2, 'quality'); rec.transition_committed = true; }
      catch (e) { rec.transition_error = classify(e); }
    }
    ctrl.push(rec);
    if ((i + 1) % 25 === 0) process.stdout.write('.');
  }
  process.stdout.write('\n');
  let ctrlOk = 0;
  for (const r of ctrl) {
    const rep_ = await report(r.assetID);
    const hist = (rep_ && rep_.provenanceHistory) || [];
    r.history_len = hist.length;
    r.stage_after = rep_ ? (rep_.currentStage || null) : null;
    r.both_present = hist.some((e) => (e.eventType || e.EventType) === 'MATERIAL_CERTIFICATION') &&
                     hist.some((e) => (e.eventType || e.EventType) === 'PRINT_JOB');
    if (r.genesis_committed && r.transition_committed && r.both_present) ctrlOk++;
  }
  out.control = {
    n: N, description: 'MATERIAL_CERTIFICATION then PRINT_JOB on the same asset, in order',
    genesis_committed: ctrl.filter((r) => r.genesis_committed).length,
    transition_committed: ctrl.filter((r) => r.transition_committed).length,
    both_events_on_ledger: ctrlOk,
    trials: ctrl,
  };
  console.log(`[lca] CONTROL committed ${ctrlOk}/${N} with both events on the ledger`);

  out.finished_at = new Date().toISOString();
  gw.close(); client.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'lifecycle_assertion.json'), JSON.stringify(out, null, 2));
  console.log(`[lca] -> ${OUT}/lifecycle_assertion.json`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
