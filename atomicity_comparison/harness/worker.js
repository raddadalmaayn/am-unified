'use strict';
/*
 * worker.js — performs ONE logical provenance+reputation operation, in one of two
 * modes, and records fsync'd progress markers so a controller that SIGKILLs this
 * process at an arbitrary moment leaves an externally-observable trail.
 *
 *   mode=twotx   : TWO independent Fabric submits (non-atomic, models design A)
 *                    tx1 ProvenanceContract:CreateMaterialCertification
 *                    tx2 ReputationContract:SubmitRating
 *   mode=unified : ONE Fabric submit (atomic, design B)
 *                    IntegrationContract:RecordProvenanceWithReputation
 *
 * Progress markers (one per line, "<unixMs>|<MARK>|<detail>"):
 *   START
 *   PROV_SUBMIT            (about to submit provenance tx)
 *   PROV_COMMITTED         (provenance tx committed)         [twotx only]
 *   REP_SUBMIT             (about to submit reputation tx)   [twotx only]
 *   REP_COMMITTED|<rid>    (reputation tx committed)         [twotx only]
 *   UNI_SUBMIT             (about to submit unified tx)      [unified only]
 *   UNI_COMMITTED          (unified tx committed)            [unified only]
 *   DONE
 *
 * Env:
 *   MODE, OP_ID, RATER_USER, RATED_ACTOR, DIMENSION, VALUE, PROGRESS_FILE,
 *   INJECT_HOLD_MS  (twotx: sleep this long AFTER PROV_COMMITTED, before REP_SUBMIT,
 *                    to widen the divergence window for the controller's kill)
 */
const fs = require('fs');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const MODE        = process.env.MODE;
const OP_ID       = process.env.OP_ID;
const RATER       = process.env.RATER_USER || 'Admin';
const RATED       = process.env.RATED_ACTOR || 'supplier_default';
const DIM         = process.env.DIMENSION || 'quality';
const VALUE       = process.env.VALUE || '0.9';
const PROG        = process.env.PROGRESS_FILE;
const HOLD_MS     = parseInt(process.env.INJECT_HOLD_MS || '0', 10);
const EVENT_TYPE  = process.env.EVENT_TYPE || 'MATERIAL_CERTIFICATION';
// PROV_APPEND=1 => after genesis, append a typed history event (varies prov event type)
const PROV_APPEND = process.env.PROV_APPEND === '1';

const fd = fs.openSync(PROG, 'a');
function mark(m, detail = '') {
  fs.writeSync(fd, `${Date.now()}|${m}|${detail}\n`);
  fs.fsyncSync(fd); // durable before we might be killed
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, RATER);
  const net = gw.getNetwork(channelName);
  mark('START', MODE);

  if (MODE === 'twotx') {
    // Design A: TWO genuinely separate chaincodes (default contract of each).
    const prov = net.getContract('prov');
    const rep  = net.getContract('rep');

    mark('PROV_SUBMIT', OP_ID);
    await prov.submitTransaction(
      'CreateMaterialCertification',
      OP_ID, 'Ti-6Al-4V', `batch-${OP_ID}`, RATED, `hash-${OP_ID}`
    );
    // For non-genesis event types, append a typed provenance event (same tx1 phase).
    if (PROV_APPEND) {
      await prov.submitTransaction('AddHistoryEvent', OP_ID, EVENT_TYPE, `hash2-${OP_ID}`);
    }
    mark('PROV_COMMITTED', OP_ID);

    if (HOLD_MS > 0) await sleep(HOLD_MS); // divergence window

    mark('REP_SUBMIT', OP_ID);
    const ts = Math.floor(Date.now() / 1000).toString();
    const ridBytes = await rep.submitTransaction(
      'SubmitRating', RATED, DIM, VALUE, OP_ID /*evidence=opId*/, ts
    );
    const rid = dec.decode(ridBytes);
    mark('REP_COMMITTED', rid);
  } else if (MODE === 'unified') {
    const integ = net.getContract(chaincodeName, 'IntegrationContract');
    mark('UNI_SUBMIT', OP_ID);
    await integ.submitTransaction(
      'RecordProvenanceWithReputation',
      OP_ID, EVENT_TYPE, `hash-${OP_ID}`, RATED, VALUE, DIM, OP_ID
    );
    mark('UNI_COMMITTED', OP_ID);
  } else {
    throw new Error('unknown MODE ' + MODE);
  }

  mark('DONE', OP_ID);
  gw.close();
  client.close();
}
main().then(() => process.exit(0)).catch((e) => {
  mark('ERROR', (e.message || String(e)).slice(0, 180).replace(/\n/g, ' '));
  process.exit(2);
});
