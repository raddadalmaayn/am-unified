'use strict';
/*
 * run.js — orchestrates a batch of fault-injected logical operations, then walks
 * the ledger to classify each as DIVERGENT / CONSISTENT / AMBIGUOUS / NOFAULT-ERR.
 *
 * Usage:
 *   node run.js --mode=twotx|unified --policy=window|random|none --n=200 \
 *               --hold=60 --rmin=20 --rmax=320 --label=NAME [--conc=1]
 *
 * Per op a child `worker.js` runs; the controller injects a fault per policy:
 *   window : SIGKILL as soon as the divergence-window trigger marker appears
 *            (twotx: PROV_COMMITTED ; unified: UNI_SUBMIT) — injection point (iii)/(iv)
 *   random : SIGKILL after a uniform random delay in [rmin, rmax] ms
 *   none   : no kill (baseline)
 *
 * Divergence definition (key-based, LevelDB-safe, independent ledger walk):
 *   twotx  : provenance asset committed on-chain (ReadAsset ok) AND reputation
 *            tx provably never submitted (no REP_SUBMIT marker) => DIVERGENT.
 *            If REP_SUBMIT seen but not REP_COMMITTED => AMBIGUOUS (rep may have
 *            committed at orderer after client death) — excluded, conservative.
 *   unified: asset and PROV_REP_LINK must agree. Exactly one present => DIVERGENT.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

function arg(name, def) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : def;
}
const MODE   = arg('mode', 'twotx');
const POLICY = arg('policy', 'window');
const N      = parseInt(arg('n', '50'), 10);
const HOLD   = parseInt(arg('hold', '60'), 10);
const RMIN   = parseInt(arg('rmin', '20'), 10);
const RMAX   = parseInt(arg('rmax', '320'), 10);
const CONC   = parseInt(arg('conc', '1'), 10);
const LABEL  = arg('label', `${MODE}_${POLICY}`);
const RATED  = arg('rated', 'supplier_run');
/*
 * D2 (2026-08-11), OPT-IN, DEFAULT OFF. With --rated-per-trial=1 each trial gets
 * its own rated actor `${opId}-actor`, matching run11.js. The default (one shared
 * actor for the whole run) is unchanged, so every pre-existing run reproduces
 * byte-for-byte.
 *
 * WHY. The shared actor makes the reputation half of a Design A trial
 * unobservable per trial from the ledger: all N trials increment one accumulator,
 * and GetRatingHistory (rating lookup by evidence=opId) needs CouchDB rich
 * queries, which this LevelDB deployment does not support. A per-trial actor
 * makes GetReputation(actor,dim).totalEvents>0 a per-trial ledger predicate --
 * exactly the rule run11.js applies to Design B -- so both arms can be judged by
 * one ruler.
 */
const RATED_PER_TRIAL = arg('rated-per-trial', '0') === '1';
const EVT    = arg('evt', 'MATERIAL_CERTIFICATION');
const DIM    = arg('dim', 'quality');
const APPEND = arg('append', '0');

const RUNDIR = path.join(process.env.ATOMICITY_LOGS_DIR || (() => { throw new Error('set ATOMICITY_LOGS_DIR to the directory that will hold run_* output') })(), `run_${LABEL}_${Date.now()}`);
fs.mkdirSync(RUNDIR, { recursive: true });
const TRIGGER = MODE === 'twotx' ? 'PROV_COMMITTED' : 'UNI_SUBMIT';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lastMarkers(progFile) {
  try {
    const lines = fs.readFileSync(progFile, 'utf8').trim().split('\n').filter(Boolean);
    return lines.map((l) => l.split('|')[1]);
  } catch { return []; }
}

// Run ONE op as a child; apply fault policy; return {opId, killed, markers, ridFromLog}
function runOne(opId) {
  return new Promise((resolve) => {
    const progFile = path.join(RUNDIR, `${opId}.prog`);
    fs.writeFileSync(progFile, '');
    const env = {
      ...process.env, MODE, OP_ID: opId, RATER_USER: 'Admin',
      RATED_ACTOR: RATED_PER_TRIAL ? `${opId}-actor` : RATED,
      DIMENSION: DIM, VALUE: '0.9', PROGRESS_FILE: progFile,
      EVENT_TYPE: EVT, PROV_APPEND: APPEND,
      INJECT_HOLD_MS: MODE === 'twotx' ? String(HOLD) : '0',
    };
    const child = spawn('node', [path.join(__dirname, 'worker.js')], { env, stdio: 'ignore' });
    let killed = false, done = false, watcher = null, randTimer = null;

    const finish = () => {
      if (done) return; done = true;
      if (watcher) clearInterval(watcher);
      if (randTimer) clearTimeout(randTimer);
      const markers = lastMarkers(progFile);
      let rid = '';
      try {
        const lines = fs.readFileSync(progFile, 'utf8').trim().split('\n');
        const rl = lines.find((l) => l.includes('|REP_COMMITTED|'));
        if (rl) rid = rl.split('|')[2];
      } catch {}
      resolve({ opId, killed, markers, rid });
    };

    if (POLICY === 'window') {
      watcher = setInterval(() => {
        if (lastMarkers(progFile).includes(TRIGGER)) {
          try { process.kill(child.pid, 'SIGKILL'); } catch {}
          killed = true;
        }
      }, 2);
    } else if (POLICY === 'random') {
      // Fire relative to the START marker (i.e. once the worker is past Node
      // startup and actively running the transaction) so the random fault lands
      // inside the active two-phase window, not in process-startup dead time.
      const delay = RMIN + Math.floor(Math.random() * Math.max(1, RMAX - RMIN));
      watcher = setInterval(() => {
        if (lastMarkers(progFile).includes('START')) {
          clearInterval(watcher); watcher = null;
          randTimer = setTimeout(() => {
            try { process.kill(child.pid, 'SIGKILL'); killed = true; } catch {}
          }, delay);
        }
      }, 2);
    }
    child.on('exit', () => finish());
  });
}

async function runBatch() {
  const ops = [];
  let idx = 0;
  async function worker() {
    while (idx < N) {
      const i = idx++;
      const opId = `${LABEL}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      ops.push(await runOne(opId));
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  return ops;
}

// ---- Ledger verification (independent key-based walk) ----
async function verify(ops) {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  // twotx provenance lives on the SEPARATE `prov` chaincode; unified on `unified`.
  const provTwo = net.getContract('prov');                                 // design A
  const provUni = net.getContract(chaincodeName, 'ProvenanceContract');    // design B
  const integ   = net.getContract(chaincodeName, 'IntegrationContract');
  const prov    = MODE === 'twotx' ? provTwo : provUni;

  async function assetExists(opId) {
    try { await prov.evaluateTransaction('ReadAsset', opId); return true; }
    catch { return false; }
  }
  async function linkExists(opId) {
    try {
      const r = await integ.evaluateTransaction('GetLinkedRatingsForAsset', opId);
      const s = dec.decode(r).trim();
      return s !== '' && s !== 'null' && s !== '[]';
    } catch { return false; }
  }

  const records = [];
  for (const op of ops) {
    const last = op.markers[op.markers.length - 1] || 'NONE';
    const provOnChain = await assetExists(op.opId);
    let cls, repState;
    if (MODE === 'twotx') {
      const repSubmitted = op.markers.includes('REP_SUBMIT');
      const repCommitted = op.markers.includes('REP_COMMITTED');
      if (last === 'ERROR') { cls = 'BIZ_ERROR'; repState = 'n/a'; }
      else if (repCommitted) { cls = provOnChain ? 'CONSISTENT' : 'BROKEN_PROV'; repState = 'committed'; }
      else if (repSubmitted) { cls = 'AMBIGUOUS'; repState = 'submitted_unknown'; }
      else { // rep provably never submitted
        repState = 'never_submitted';
        cls = provOnChain ? 'DIVERGENT' : 'CLEAN_ABORT';
      }
    } else { // unified
      const link = await linkExists(op.opId);
      if (last === 'ERROR') { cls = 'BIZ_ERROR'; }
      else if (provOnChain && link) cls = 'CONSISTENT';
      else if (!provOnChain && !link) cls = 'CLEAN_ABORT';
      else cls = 'DIVERGENT';
      repState = link ? 'link_present' : 'link_absent';
    }
    records.push({ opId: op.opId, killed: op.killed, last, provOnChain, repState, cls });
  }
  gw.close(); client.close();
  return records;
}

(async () => {
  console.log(`[run] mode=${MODE} policy=${POLICY} n=${N} hold=${HOLD} rand=[${RMIN},${RMAX}] conc=${CONC} label=${LABEL}`);
  const t0 = Date.now();
  const ops = await runBatch();
  const records = await verify(ops);
  const summary = {};
  for (const r of records) summary[r.cls] = (summary[r.cls] || 0) + 1;
  const killedN = records.filter((r) => r.killed).length;
  const out = {
    label: LABEL, mode: MODE, policy: POLICY, n: N, hold_ms: HOLD,
    rand_ms: [RMIN, RMAX], conc: CONC, rated: RATED,
    rated_per_trial: RATED_PER_TRIAL,
    elapsed_ms: Date.now() - t0, killed: killedN, summary, records,
  };
  const outFile = path.join(RUNDIR, 'result.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  const div = summary.DIVERGENT || 0;
  console.log(`[run] killed=${killedN}/${N}  summary=${JSON.stringify(summary)}`);
  console.log(`[run] DIVERGENT=${div}  rate=${(div / N * 100).toFixed(2)}%  -> ${outFile}`);
})().catch((e) => { console.error('RUN_FATAL', e); process.exit(1); });
