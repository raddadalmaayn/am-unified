'use strict';
/*
 * worker11.js — ONE unified (Design B) logical operation, with the submit split
 * into its three real phases so a controller can kill at a point that actually
 * matters.
 *
 * WHY THIS EXISTS. The June harness (worker.js) marked UNI_SUBMIT *before*
 * calling submitTransaction(), which is endorse+submit+commit fused. The window
 * controller killed on that marker, i.e. before the proposal was even endorsed.
 * All 6,900 published Design B trials were therefore CLEAN_ABORT: the
 * transaction never reached the orderer and no trial could have exhibited a
 * divergence. The published zero is zero out of zero opportunities.
 *
 * Markers (fsync'd, one per line, "<unixMs>|<MARK>|<detail>"):
 *   START
 *   ENDORSE_DONE|<txID>     proposal endorsed; txID now known
 *   SUBMIT_RETURNED|<txID>  the ORDERER HAS ACCEPTED the transaction. Killing
 *                           after this point cannot prevent the commit, so this
 *                           is where an atomicity violation would become visible
 *                           as a partial write.
 *   COMMIT_RESOLVED|<code>  commit status observed by this client
 *   DONE
 *   ERROR|<msg>
 *
 * PER-TRIAL UNIQUE RATED ACTOR. The reputation accumulator key is
 * REPUTATION:<actor>:<dimension>, which is shared by every trial rating the same
 * actor. A shared key cannot answer "did THIS trial's rating commit". Each trial
 * therefore rates its own actor, derived from OP_ID, making the accumulator a
 * per-trial key. This is an instrumentation change from June and is disclosed.
 *
 * Env: OP_ID, RATED_ACTOR, DIMENSION, VALUE, EVENT_TYPE, PROGRESS_FILE
 */
const fs = require('fs');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');

const OP_ID  = process.env.OP_ID;
const RATED  = process.env.RATED_ACTOR;
const DIM    = process.env.DIMENSION || 'quality';
const VALUE  = process.env.VALUE || '0.9';
const EVT    = process.env.EVENT_TYPE || 'MATERIAL_CERTIFICATION';
const PROG   = process.env.PROGRESS_FILE;

const fd = fs.openSync(PROG, 'a');
function mark(m, detail = '') {
  fs.writeSync(fd, `${Date.now()}|${m}|${detail}\n`);
  fs.fsyncSync(fd); // durable before we might be killed
}

async function main() {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const integ = net.getContract(chaincodeName, 'IntegrationContract');

  mark('START', OP_ID);

  const proposal = integ.newProposal('RecordProvenanceWithReputation', {
    arguments: [OP_ID, EVT, `hash-${OP_ID}`, RATED, VALUE, DIM, OP_ID],
  });

  const transaction = await proposal.endorse();
  const txId = transaction.getTransactionId();
  mark('ENDORSE_DONE', txId);

  const commit = await transaction.submit();
  // submit() has returned: the ordering service accepted the envelope.
  mark('SUBMIT_RETURNED', txId);

  const status = await commit.getStatus();
  mark('COMMIT_RESOLVED', `${status.code}:${status.successful}`);

  mark('DONE', txId);
  gw.close();
  client.close();
}

main().then(() => process.exit(0)).catch((e) => {
  mark('ERROR', (e.message || String(e)).slice(0, 180).replace(/\n/g, ' '));
  process.exit(2);
});
