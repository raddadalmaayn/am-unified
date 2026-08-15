'use strict';
/*
 * run_ccfault.js — injection points (i) and (ii), only possible now that the
 * reputation chaincode is a SEPARATE container/process from provenance.
 *
 *   fault=stop     : (i)  `docker stop` the rep CCAAS containers — reputation
 *                    chaincode process is killed; provenance (separate cc) is fine.
 *   fault=netsever : (ii) `docker network disconnect` the rep CCAAS containers —
 *                    they stay alive but the peer can't reach them (severed link).
 *
 * Protocol per op (gateway, inline; no SIGKILL needed — the fault is the cc being
 * unreachable): prov.CreateMaterialCertification(opId) commits, then
 * rep.SubmitRating(actor=opId) is attempted and FAILS (rep unreachable).
 * Each op uses a UNIQUE rated actor == opId so reputation presence is checkable
 * per-op after recovery.
 *
 * Verification (independent, both chaincodes): provenance present iff
 * prov.ReadAsset(opId) ok; reputation present iff rep.GetReputation(opId).totalEvents>0.
 * DIVERGENT = provenance present AND reputation absent.
 *
 * Usage: node run_ccfault.js --fault=stop|netsever --n=50 --label=NAME
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

function arg(n, d) { const m = process.argv.find((a) => a.startsWith(`--${n}=`)); return m ? m.split('=')[1] : d; }
const FAULT = arg('fault', 'stop');
const N     = parseInt(arg('n', '50'), 10);
const CONC  = parseInt(arg('conc', '10'), 10);
const LABEL = arg('label', `ccfault_${FAULT}`);
const REPC  = ['peer0org1_rep_ccaas', 'peer0org2_rep_ccaas'];
const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERR:' + (e.stderr || e.stdout || e.message).toString().trim(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUNDIR = path.join(process.env.ATOMICITY_LOGS_DIR || (() => { throw new Error('set ATOMICITY_LOGS_DIR to the directory that will hold run_* output') })(), `run_${LABEL}_${Date.now()}`);
fs.mkdirSync(RUNDIR, { recursive: true });

// short-deadline gateway so failed rep submits return fast
function fastGateway(client) {
  const cryptoPath = process.env.FABRIC_CRYPTO_PATH || (() => { throw new Error('set FABRIC_CRYPTO_PATH to the org1.example.com peerOrganizations directory') })();
  const certPath = path.join(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'signcerts', 'cert.pem');
  const keyDir = path.join(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'keystore');
  const keyFile = fs.readdirSync(keyDir)[0];
  return connect({
    client,
    identity: { mspId: 'Org1MSP', credentials: fs.readFileSync(certPath) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(keyDir, keyFile)))),
    evaluateOptions: () => ({ deadline: Date.now() + 15000 }),
    endorseOptions:  () => ({ deadline: Date.now() + 4000 }),
    submitOptions:   () => ({ deadline: Date.now() + 4000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 15000 }),
  });
}

async function main() {
  console.log(`[ccfault] fault=${FAULT} n=${N} label=${LABEL}`);
  const client = newGrpcConnection();
  const gw = fastGateway(client);
  const net = gw.getNetwork(channelName);
  const prov = net.getContract('prov');
  const rep  = net.getContract('rep');

  // ---- Inject the fault (reputation unreachable) ----
  let injectLog = '';
  if (FAULT === 'stop') {
    injectLog = sh(`docker stop ${REPC.join(' ')}`);
  } else {
    injectLog = REPC.map((c) => sh(`docker network disconnect fabric_test ${c}`)).join('; ') || 'disconnected';
  }
  console.log(`[ccfault] injected (${FAULT}): ${injectLog}`);
  await sleep(2000); // let the peer notice the chaincode is gone

  // ---- Drive N ops while reputation is unreachable (concurrency=CONC) ----
  const ops = new Array(N);
  const tStart = Date.now();
  let next = 0;
  async function lane() {
    while (next < N) {
      const i = next++;
      const opId = `${LABEL}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      const rec = { opId, provCommitted: false, repError: '', repCommitted: false };
      try {
        await prov.submitTransaction('CreateMaterialCertification', opId, 'Ti-6Al-4V', `batch-${opId}`, opId, `hash-${opId}`);
        rec.provCommitted = true;
      } catch (e) { rec.provError = (e.message || String(e)).slice(0, 100); }
      if (rec.provCommitted) {
        try {
          const ts = Math.floor(Date.now() / 1000).toString();
          await rep.submitTransaction('SubmitRating', opId, 'quality', '0.9', `ev-${opId}`, ts);
          rec.repCommitted = true; // should NOT happen while rep is down
        } catch (e) { rec.repError = (e.message || String(e)).slice(0, 120).replace(/\n/g, ' '); }
      }
      ops[i] = rec;
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => lane()));
  const driveMs = Date.now() - tStart;
  console.log(`[ccfault] drove ${N} ops in ${driveMs}ms while rep unreachable`);

  // ---- Recover reputation ----
  let recoverLog = '';
  if (FAULT === 'stop') recoverLog = sh(`docker start ${REPC.join(' ')}`);
  else recoverLog = REPC.map((c) => sh(`docker network connect fabric_test ${c}`)).join('; ') || 'reconnected';
  console.log(`[ccfault] recovered: ${recoverLog}`);
  await sleep(9000); // let CCAAS re-register with peers

  // re-smoke rep to confirm it's back
  let repBack = 'unknown';
  for (let k = 0; k < 5; k++) {
    try { await rep.evaluateTransaction('GetReputation', 'supplier_smoke_rep', 'quality'); repBack = 'OK'; break; }
    catch (e) { repBack = (e.message || String(e)).slice(0, 80); await sleep(3000); }
  }
  console.log(`[ccfault] rep back: ${repBack}`);

  // ---- Verify each op on BOTH chaincodes ----
  const records = [];
  for (const op of ops) {
    let provOnChain = false, repEvents = -1;
    try { await prov.evaluateTransaction('ReadAsset', op.opId); provOnChain = true; } catch {}
    try {
      const r = await rep.evaluateTransaction('GetReputation', op.opId, 'quality');
      const j = JSON.parse(dec.decode(r)); repEvents = j.totalEvents;
    } catch (e) { repEvents = -2; /* query failed */ }
    let cls;
    if (provOnChain && repEvents <= 0) cls = 'DIVERGENT';
    else if (provOnChain && repEvents > 0) cls = 'CONSISTENT';
    else if (!provOnChain && repEvents <= 0) cls = 'CLEAN_ABORT';
    else cls = 'BROKEN_REP_ONLY';
    records.push({ opId: op.opId, provOnChain, repEvents, repError: op.repError ? op.repError.slice(0, 60) : '', cls });
  }
  const summary = {};
  for (const r of records) summary[r.cls] = (summary[r.cls] || 0) + 1;
  const out = { label: LABEL, fault: FAULT, n: N, drive_ms: driveMs, inject: injectLog, recover: recoverLog, rep_back: repBack, summary, records };
  fs.writeFileSync(path.join(RUNDIR, 'result.json'), JSON.stringify(out, null, 2));
  const div = summary.DIVERGENT || 0;
  console.log(`[ccfault] summary=${JSON.stringify(summary)}  DIVERGENT=${div}  rate=${(div / N * 100).toFixed(2)}%`);
  console.log(`[ccfault] -> ${path.join(RUNDIR, 'result.json')}`);
  gw.close(); client.close();
}
main().catch((e) => { console.error('CCFAULT_FATAL', e); process.exit(1); });
