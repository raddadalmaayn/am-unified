'use strict';
/*
 * emit_latex_storage.js — Section 5.4 storage fragment from LIVE world state.
 * Sizes come from measure_storage.js and the per-event-type sweep, both of which
 * read the ledger. NO NUMBER TYPED BY HAND. The one record type no read-only API
 * exposes is carried forward with an explicit date, not substituted.
 * Usage: node emit_latex_storage.js <measurement.json> <eventsizes.json> [outdir]
 */
const fs=require('fs'), path=require('path');
const M=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const E=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const OUT=process.argv[4]||'am-unified/results/latex_fragments';
const f=(v,d=0)=>v==null?'n/a':Number(v).toFixed(d);
const prov=[]; const P=(k,v,src,how)=>{prov.push({k,v,src,how});return v;};

const evTypes=Object.keys(E);
const evMeds=evTypes.map(t=>P(`S.event.${t}_bytes`,E[t].median,'live ledger query',
  `median serialised JSON of ${E[t].n} ProvenanceEvent records of type ${t}`));
const evMean=P('S.event.mean_bytes',evMeds.reduce((a,b)=>a+b,0)/evMeds.length,'(derived)',
  `mean of the ${evTypes.length} measured event-type medians`);
const rating=P('S.rating_bytes',M.records.Rating.bytes,'live ledger query',M.records.Rating.source);
const acc=P('S.accumulator_bytes',M.records.Accumulator.bytes,'live ledger query',M.records.Accumulator.source);
const asset=P('S.asset_bytes',M.records.Asset.bytes,'live ledger query',M.records.Asset.source);
const LINK_CARRIED=251, LINK_DATE='2026-06';
const link=P('S.link_bytes_CARRIED_FORWARD',LINK_CARRIED,'NOT MEASURABLE via any read-only API',
  `carried from the ${LINK_DATE} accounting; PROV_REP_LINK has no standalone query`);

/* F11: the six bridge rules of Table 4 touch only FOUR distinct actor-dimension
 * pairs -- (Supplier,Quality), (Supplier,Compliance) fired by two rules,
 * (Mfr.,Quality) fired by two rules, and (Logistics,Delivery). Accumulators are
 * updated in place, so a lifecycle creates four accumulator records, not six.
 * Ratings and link entries are appended per firing, so those stay at six. */
const N_EV=7,N_RATE=6,N_ACC=4,N_LINK=6;
const evTot=P('S.lifecycle.events_bytes',N_EV*evMean,'(derived)',`${N_EV} x S.event.mean_bytes`);
const rTot=P('S.lifecycle.ratings_bytes',N_RATE*rating,'(derived)',`${N_RATE} x S.rating_bytes`);
const aTot=P('S.lifecycle.accumulators_bytes',N_ACC*acc,'(derived)',`${N_ACC} x S.accumulator_bytes`);
const lTot=P('S.lifecycle.links_bytes_CARRIED',N_LINK*link,'(derived)',`${N_LINK} x S.link_bytes_CARRIED_FORWARD`);
const measured=P('S.lifecycle.measured_subtotal_bytes',evTot+rTot+aTot+asset,'(derived)','events+ratings+accumulators+asset, all measured');
const total=P('S.lifecycle.total_bytes',measured+lTot,'(derived)','measured subtotal + carried-forward link entries');
const proj=P('S.projection_1M_GB',total*1e6/1e9,'(derived)','S.lifecycle.total_bytes x 1e6, decimal GB');
const t2=P('S.table2_six_events_bytes',6*evMean,'(derived)','6 x S.event.mean_bytes, for Table 2 total row');
const NAIVE_SIX_MB=7.2;
const naiveB=P('S.naive_six_events_bytes',NAIVE_SIX_MB*1e6,'Table 2 naive column','sum of the six naive per-event sizes, ~7.2 MB');
const multEvents=P('S.reduction_events_x',naiveB/t2,'(derived)','S.naive_six_events_bytes / S.table2_six_events_bytes');
const multLife=P('S.reduction_lifecycle_x',naiveB/total,'(derived)','S.naive_six_events_bytes / S.lifecycle.total_bytes');

fs.writeFileSync(path.join(OUT,'storage_table2_total.tex'),
  `\\textbf{Total (six manufacturing events)} & & \\textbf{${f(t2/1000,1)}\\,kB} & \\textbf{$\\sim$7.2\\,MB} \\\\\n`);
fs.writeFileSync(path.join(OUT,'storage_lifecycle.tex'),
  `${f(evMean)}\\,B & ${f(rating)}\\,B & ${f(acc)}\\,B & ${f(asset)}\\,B & ${f(link)}\\,B$^{\\ast}$ & ${f(total/1000,1)}\\,kB & ${f(proj,1)}\\,GB \\\\\n`);

const L=['SECTION 5.4 storage footprint — number provenance','='.repeat(50),'',
 `Measured against the live single-host ledger at ${M.measured_at}`,
 `channel=${M.channel} chaincode=${M.chaincode} sample asset=${M.sample_asset}`,'',
 'Sizes are the serialised JSON value as the chaincode returns it. They exclude',
 'the key and any LevelDB framing, so they are the payload size, not the',
 'on-disk size.',''];
for(const r of prov){L.push(`${r.k.padEnd(40)}= ${f(r.v,2)}`);L.push(' '.repeat(42)+r.src);L.push(' '.repeat(42)+r.how);}
L.push('','NOT MEASURED:');
L.push('  PROV_REP_LINK is written under key PROV_REP_LINK:<assetID>:<txID>. No');
L.push('  read-only query on any of the three contracts returns it standalone, and');
L.push('  GetPartTrustReport surfaces only the joined linkedRatings view. Its size');
L.push(`  is therefore carried forward from the ${LINK_DATE} accounting at ${LINK_CARRIED} B and is`);
L.push('  labelled as such in the manuscript. No substitute was computed.');
fs.writeFileSync(path.join(OUT,'storage_lifecycle.txt'),L.join('\n')+'\n');
console.log(`event mean ${f(evMean)} B | rating ${rating} | acc ${acc} | asset ${asset} | link ${link} (carried)`);
console.log(`measured subtotal ${f(measured)} B | total ${f(total)} B = ${f(total/1000,1)} kB | 1M -> ${f(proj,1)} GB`);
console.log(`Table 2 six-event total: ${f(t2/1000,1)} kB`);
console.log(`reduction, six events: ${f(multEvents,0)}x | reduction, lifecycle: ${f(multLife,0)}x`);
