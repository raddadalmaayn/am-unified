'use strict';
/*
 * reverify_pertrial.js — D2, full symmetry (2026-08-11).
 *
 * Re-classifies a Design A (twotx) run that was executed with
 * --rated-per-trial=1 using EXACTLY the rule run11.js applies to Design B:
 * every presence fact read from the ledger, per trial, never from a marker.
 *
 *   provenance  <- prov:ReadAsset(opId)                     succeeds
 *   reputation  <- rep:GetReputation(`${opId}-actor`, dim).totalEvents > 0
 *
 * The accumulator predicate is `totalEvents > 0` and not `alpha>1||beta>1`
 * because the STANDALONE rep chaincode synthesises {alpha:2,beta:2,totalEvents:0}
 * for a never-rated actor exactly as the unified one does -- verified in both
 * directions against this live ledger before adopting (a rated actor reads
 * totalEvents>=1; an unrated one reads 0).
 *
 * Classification, same shape as run11.js:
 *   NEITHER    neither present
 *   BOTH       both present
 *   DIVERGENT  a proper subset  <-- this is the divergence
 */
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName } = require('./lib');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const RUNDIR = process.argv[2];
const DIM = process.argv[3] || 'quality';
if (!RUNDIR) { console.error('usage: node reverify_pertrial.js <rundir> [dim]'); process.exit(1); }

function wilsonUpper(k, n, z = 1.96) {
  if (n === 0) return null;
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return ((c + s) / d) * 100;
}

async function main() {
  const src = JSON.parse(fs.readFileSync(path.join(RUNDIR, 'result.json'), 'utf8'));
  if (!src.rated_per_trial) {
    console.error('REFUSING: this run was not executed with --rated-per-trial=1, so the ' +
                  'reputation half is not per-trial observable. Use reverify_d4.js instead.');
    process.exit(2);
  }
  console.log(`[d2b] rundir=${path.basename(RUNDIR)} n=${src.n} per-trial actors dim=${DIM}`);

  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const prov = net.getContract('prov');
  const rep = net.getContract('rep');

  const out = [];
  let i = 0;
  for (const r of src.records) {
    let provPresent = false, repPresent = false, acc = null;
    try { await prov.evaluateTransaction('ReadAsset', r.opId); provPresent = true; } catch {}
    try {
      const raw = await rep.evaluateTransaction('GetReputation', `${r.opId}-actor`, DIM);
      acc = JSON.parse(dec.decode(raw));
      repPresent = !!(acc && acc.totalEvents > 0);
    } catch {}
    const n = [provPresent, repPresent].filter(Boolean).length;
    const cls = n === 0 ? 'NEITHER' : n === 2 ? 'BOTH' : 'DIVERGENT';
    out.push({ opId: r.opId, killed: r.killed, provPresent, repPresent,
               totalEvents: acc ? acc.totalEvents : null,
               cls_ledger: cls, cls_original: r.cls,
               agrees: (cls === 'DIVERGENT') === (r.cls === 'DIVERGENT') });
    if (++i % 100 === 0) console.log(`[d2b]   ${i}/${src.records.length}`);
  }
  gw.close(); client.close();

  const summary = {};
  for (const r of out) summary[r.cls_ledger] = (summary[r.cls_ledger] || 0) + 1;
  const disagree = out.filter((r) => !r.agrees);
  const div = summary.DIVERGENT || 0;

  const result = {
    reverified_at: new Date().toISOString(),
    purpose: 'D2 full symmetry: Design A classified per trial by the run11.js ledger-only rule',
    rundir: path.basename(RUNDIR), n: src.n, dim: DIM, rated_per_trial: true,
    predicate: "prov:ReadAsset(opId) AND rep:GetReputation(`${opId}-actor`,dim).totalEvents>0 — ledger only, per trial",
    summary_ledger: summary, summary_original: src.summary,
    divergences: div, divergence_rate_pct: (div / src.n) * 100,
    wilson95_upper_pct: wilsonUpper(div, src.n),
    disagreements: disagree.length, disagreement_detail: disagree.slice(0, 20),
    records: out,
  };
  fs.writeFileSync(path.join(RUNDIR, 'result_D2_PERTRIAL_LEDGER.json'), JSON.stringify(result, null, 2));
  console.log(`[d2b] ledger summary=${JSON.stringify(summary)} original=${JSON.stringify(src.summary)}`);
  console.log(`[d2b] DIVERGENT=${div}/${src.n} disagreements=${disagree.length}`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
