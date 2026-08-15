'use strict';
/*
 * measure_storage.js — Section 5.4 storage footprint, measured from world state.
 *
 * Reads ONE live instance of each on-chain record type through the chaincode's
 * read-only query interface and reports the serialised JSON byte length of the
 * value as the chaincode returns it. This is the size of the value the peer
 * stores under its key; it excludes the key itself and any LevelDB framing, and
 * that scope is stated in the output rather than silently assumed.
 *
 * Record types (five, matching the manuscript's decomposition):
 *   ProvenanceEvent   one element of GetPartTrustReport().provenanceHistory
 *   Asset             the asset record itself
 *   Rating            one element of GetPartTrustReport().linkedRatings
 *   Accumulator       GetReputation(actor, dimension)
 *   LinkIndex         the PROV_REP_LINK entry
 *
 * If a type cannot be located on the current ledger it is reported as NOT FOUND
 * and no substitute is offered.
 *
 * Usage: node measure_storage.js <outdir>
 */
const fs = require('fs');
const path = require('path');
const { newGrpcConnection, gatewayFor, channelName, chaincodeName } = require('atomicity_comparison/harness/lib.js');
const { TextDecoder } = require('util');
const dec = new TextDecoder();

const OUT = process.argv[2] || '/tmp';
const bytes = (o) => Buffer.byteLength(JSON.stringify(o), 'utf8');

async function main() {
  const client = newGrpcConnection();
  const gw = gatewayFor(client, 'Admin');
  const net = gw.getNetwork(channelName);
  const integ = net.getContract(chaincodeName, 'IntegrationContract');
  const rep = net.getContract(chaincodeName, 'ReputationContract');
  const prov = net.getContract(chaincodeName, 'ProvenanceContract');

  const out = { measured_at: new Date().toISOString(), channel: channelName,
                chaincode: chaincodeName, records: {}, notes: [] };

  // Find an asset that carries a full bridge operation: history + linked rating.
  const seeds = process.argv.slice(3);
  let report = null, assetId = null;
  for (const s of seeds) {
    try {
      const raw = await integ.evaluateTransaction('GetPartTrustReport', s);
      const r = JSON.parse(dec.decode(raw));
      if (r && Array.isArray(r.provenanceHistory) && r.provenanceHistory.length &&
          Array.isArray(r.linkedRatings) && r.linkedRatings.length) { report = r; assetId = s; break; }
    } catch { /* try next */ }
  }
  if (!report) { console.error('FATAL: no seed asset carried both history and linked ratings'); process.exit(2); }
  out.sample_asset = assetId;

  const ev = report.provenanceHistory[0];
  out.records.ProvenanceEvent = { bytes: bytes(ev), source: 'GetPartTrustReport().provenanceHistory[0]',
                                  eventType: ev.eventType || ev.EventType || null };

  const rt = report.linkedRatings[0];
  out.records.Rating = { bytes: bytes(rt), source: 'GetPartTrustReport().linkedRatings[0]' };

  // Asset record
  try {
    const raw = await prov.evaluateTransaction('ReadAsset', assetId);
    out.records.Asset = { bytes: bytes(JSON.parse(dec.decode(raw))), source: 'ProvenanceContract:ReadAsset' };
  } catch (e) {
    if (report.asset) out.records.Asset = { bytes: bytes(report.asset), source: 'GetPartTrustReport().asset' };
    else out.records.Asset = { bytes: null, source: 'NOT FOUND', error: String(e.message).slice(0, 160) };
  }

  // Reputation accumulator
  const actor = rt.ratedActor || rt.RatedActor || rt.actorId || null;
  const dim = rt.dimension || rt.Dimension || 'quality';
  if (actor) {
    try {
      const raw = await rep.evaluateTransaction('GetReputation', actor, dim);
      out.records.Accumulator = { bytes: bytes(JSON.parse(dec.decode(raw))),
                                  source: `ReputationContract:GetReputation(${actor}, ${dim})` };
    } catch (e) {
      out.records.Accumulator = { bytes: null, source: 'NOT FOUND', error: String(e.message).slice(0, 160) };
    }
  } else out.records.Accumulator = { bytes: null, source: 'NOT FOUND: no rated actor on the sample rating' };

  // Link index entry
  const linkKeys = Object.keys(report).filter((k) => /link/i.test(k));
  out.notes.push(`GetPartTrustReport keys: ${Object.keys(report).join(', ')}`);
  if (report.linkedRatings && report.linkedRatings.length) {
    // The link entry is the PROV_REP_LINK record; the report surfaces it as the
    // binding between event and rating. Measure the binding object itself.
    const link = rt.linkRecord || rt.link || null;
    out.records.LinkIndex = link
      ? { bytes: bytes(link), source: 'linkedRatings[0].linkRecord' }
      : { bytes: null, source: 'NOT FOUND: no discrete link record exposed by any read-only query',
          note: 'PROV_REP_LINK is written under key PROV_REP_LINK:<assetID>:<txID>; no query API returns it standalone' };
  }
  out.notes.push(`link-ish report keys: ${linkKeys.join(', ') || 'none'}`);
  out.notes.push('Sizes are the serialised JSON value as returned by the chaincode; they exclude the key and LevelDB framing.');

  gw.close(); client.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'storage_measurement.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
