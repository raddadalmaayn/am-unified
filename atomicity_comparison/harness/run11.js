'use strict';
/*
 * run11.js — Phase 11 controller. Runs N Design B trials under one kill policy,
 * then performs an INDEPENDENT THREE-KEY LEDGER WALK and classifies each trial.
 *
 * Kill policies, calibrated against the real phase boundaries (C2):
 *   none        no kill (calibration / baseline)
 *   pre         SIGKILL on START            -> expect NEITHER
 *   postendorse SIGKILL on ENDORSE_DONE     -> expect NEITHER
 *   postsubmit  SIGKILL on SUBMIT_RETURNED  -> expect ALL_THREE
 *   random      SIGKILL after U[0, RMAX] ms -> expect a mix
 *
 * THE THREE KEYS (C4), read with existing read-only APIs, never from a marker:
 *   1. ProvenanceEvent record   -> GetPartTrustReport(assetID).provenanceHistory
 *   2. reputation accumulator   -> GetReputation(ratedActor, dimension)
 *      (per-trial actor, so this key belongs to this trial alone)
 *   3. PROV_REP_LINK entry      -> GetPartTrustReport(assetID).linkedRatings
 *
 * Classification:
 *   NEITHER    none of the three present
 *   ALL_THREE  all three present
 *   PARTIAL    any proper subset  <-- THIS IS A DIVERGENCE
 *
 * Usage:
 *   node run11.js --policy=none|pre|postendorse|postsubmit|random --n=500 \
 *                 --rmax=MS --evt=EVENT_TYPE --dim=DIM --label=NAME [--conc=1]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

function arg(n, d) {
  const p = process.argv.find((a) => a.startsWith(`--${n}=`));
  return p ? p.split('=')[1] : d;
}
const POLICY = arg('policy', 'none');
const N      = parseInt(arg('n', '100'), 10);
const RMAX   = parseInt(arg('rmax', '2000'), 10);
const EVT    = arg('evt', 'MATERIAL_CERTIFICATION');
const DIM    = arg('dim', 'quality');
const CONC   = parseInt(arg('conc', '1'), 10);
const LABEL  = arg('label', `P11_${POLICY}`);
const RUNDIR = path.join(process.env.ATOMICITY_LOGS_DIR || (() => { throw new Error('set ATOMICITY_LOGS_DIR to the directory that will hold run_* output') })(), `run_${LABEL}_${Date.now()}`);
fs.mkdirSync(RUNDIR, { recursive: true });

const TRIGGER = { pre: 'START', postendorse: 'ENDORSE_DONE', postsubmit: 'SUBMIT_RETURNED' }[POLICY];

function markersOf(f) {
  try {
    return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
      .map((l) => ({ t: +l.split('|')[0], m: l.split('|')[1], d: l.split('|')[2] }));
  } catch { return []; }
}

function runOne(opId, ratedActor) {
  return new Promise((resolve) => {
    const progFile = path.join(RUNDIR, `${opId}.prog`);
    fs.writeFileSync(progFile, '');
    const env = { ...process.env, OP_ID: opId, RATED_ACTOR: ratedActor,
                  DIMENSION: DIM, VALUE: '0.9', EVENT_TYPE: EVT, PROGRESS_FILE: progFile };
    const child = spawn('node', [path.join(__dirname, 'worker11.js')], { env, stdio: 'ignore' });
    let killed = false, done = false, watcher = null, timer = null;

    const finish = () => {
      if (done) return; done = true;
      if (watcher) clearInterval(watcher);
      if (timer) clearTimeout(timer);
      const ms = markersOf(progFile);
      const txId = (ms.find((x) => x.m === 'ENDORSE_DONE') || {}).d || null;
      resolve({ opId, ratedActor, killed, txId, markers: ms.map((x) => x.m) });
    };

    if (TRIGGER) {
      watcher = setInterval(() => {
        if (markersOf(progFile).some((x) => x.m === TRIGGER)) {
          try { process.kill(child.pid, 'SIGKILL'); } catch {}
          killed = true;
        }
      }, 2);
    } else if (POLICY === 'random') {
      /*
       * DEFECT FIX (2026-08-11): the delay must be measured from START, not from
       * spawn(). A Node child needs roughly 450 ms to boot and connect its
       * gateway before it writes START, whereas C1 characterised the transaction
       * lifetime (P95 285 ms) FROM START. Timing the delay from spawn therefore
       * placed every kill inside process startup: the first attempt returned
       * NEITHER 500/500 with NO MARKERS AT ALL in any trial, i.e. not one
       * transaction had begun when it was killed. Arm on START, then apply the
       * random delay, so the kill is uniform over the interval C1 measured.
       */
      let armed = false;
      watcher = setInterval(() => {
        if (armed) return;
        if (markersOf(progFile).some((x) => x.m === 'START')) {
          armed = true;
          clearInterval(watcher); watcher = null;
          timer = setTimeout(() => {
            try { process.kill(child.pid, 'SIGKILL'); killed = true; } catch {}
          }, Math.floor(Math.random() * RMAX));
        }
      }, 2);
    }
    child.on('exit', finish);
    child.on('error', finish);
  });
}

// ---- C4: independent three-key ledger walk ----
async function verify(ops) {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const integ = net.getContract(chaincodeName, 'IntegrationContract');
  const rep = net.getContract(chaincodeName, 'ReputationContract');

  const out = [];
  for (const op of ops) {
    let evPresent = false, linkPresent = false, accPresent = false;
    try {
      const raw = await integ.evaluateTransaction('GetPartTrustReport', op.opId);
      const r = JSON.parse(dec.decode(raw));
      evPresent   = Array.isArray(r.provenanceHistory) && r.provenanceHistory.length > 0;
      linkPresent = Array.isArray(r.linkedRatings) && r.linkedRatings.length > 0;
    } catch { /* asset absent => both absent */ }
    try {
      const raw = await rep.evaluateTransaction('GetReputation', op.ratedActor, DIM);
      const s = JSON.parse(dec.decode(raw));
      // DEFECT FIX (2026-08-11): GetReputation SYNTHESISES a default record for
      // an actor that has never been rated -- {alpha:2, beta:2, totalEvents:0}.
      // The previous predicate (alpha>1 || beta>1) was therefore ALWAYS true, so
      // the accumulator always read "present" and NEITHER could never be
      // returned. P1 (kill before endorsement, nothing written) was misreported
      // as PARTIAL 500/500. totalEvents is the only field that discriminates:
      // 0 for a never-rated actor, >=1 once a rating commits. Verified in both
      // directions against the live ledger before adopting.
      accPresent = !!(s && s.totalEvents > 0);
    } catch { /* accumulator absent */ }

    const n = [evPresent, linkPresent, accPresent].filter(Boolean).length;
    const cls = n === 0 ? 'NEITHER' : n === 3 ? 'ALL_THREE' : 'PARTIAL';
    out.push({ ...op, evPresent, linkPresent, accPresent, cls });
  }
  gw.close(); client.close();
  return out;
}

function wilsonUpper(k, n, z = 1.96) {
  if (n === 0) return null;
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return ((c + s) / d) * 100;
}

async function main() {
  console.log(`[p11] policy=${POLICY} n=${N} evt=${EVT} dim=${DIM} conc=${CONC} rmax=${RMAX} label=${LABEL}`);
  const t0 = Date.now();
  const ops = [];
  let idx = 0;
  async function w() {
    while (idx < N) {
      const i = idx++;
      const opId = `${LABEL}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      ops.push(await runOne(opId, `${opId}-actor`));
    }
  }
  await Promise.all(Array.from({ length: CONC }, w));
  const elapsed = Date.now() - t0;

  // settle: let any in-flight commit resolve before walking the ledger
  await new Promise((r) => setTimeout(r, 5000));
  const records = await verify(ops);

  const summary = {};
  for (const r of records) summary[r.cls] = (summary[r.cls] || 0) + 1;
  const partial = records.filter((r) => r.cls === 'PARTIAL');

  const result = {
    label: LABEL, policy: POLICY, n: N, evt: EVT, dim: DIM, conc: CONC, rmax: RMAX,
    elapsed_ms: elapsed, ms_per_trial: elapsed / N,
    killed: records.filter((r) => r.killed).length,
    summary,
    divergences: partial.length,
    divergence_rate_pct: (partial.length / N) * 100,
    wilson95_upper_pct: wilsonUpper(partial.length, N),
    partial_detail: partial.slice(0, 20),
    records,
  };
  fs.writeFileSync(path.join(RUNDIR, 'result.json'), JSON.stringify(result, null, 2));
  console.log(`[p11] killed=${result.killed}/${N} summary=${JSON.stringify(summary)}`);
  console.log(`[p11] PARTIAL(divergent)=${partial.length} rate=${result.divergence_rate_pct.toFixed(2)}% ` +
              `wilson95upper=${result.wilson95_upper_pct.toFixed(4)}% -> ${RUNDIR}/result.json`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
