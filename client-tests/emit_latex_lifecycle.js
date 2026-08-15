'use strict';
/*
 * emit_latex_lifecycle.js — Section 5 lifecycle-assertion fragment.
 * Reads lifecycle_assertion.json produced by lifecycle_assertion_test.js.
 * NO NUMBER TYPED BY HAND.
 * Usage: node emit_latex_lifecycle.js <lifecycle_assertion.json> [outdir]
 */
const fs=require('fs'), path=require('path');
const SRC=process.argv[2];
const OUT=process.argv[3]||'am-unified/results/latex_fragments';
const d=JSON.parse(fs.readFileSync(SRC,'utf8'));
const prov=[]; const P=(k,v,how)=>{prov.push({k,v,how});return v;};
const NAME={PRINT_JOB_on_absent_asset:['\\texttt{PRINT\\_JOB}','asset absent'],
            INSPECTION_on_material_certified:['\\texttt{INSPECTION}','\\texttt{MATERIAL\\_CERTIFIED}'],
            CERTIFICATION_on_material_certified:['\\texttt{CERTIFICATION}','\\texttt{MATERIAL\\_CERTIFIED}']};
const REQ={PRINT_JOB_on_absent_asset:'\\texttt{MATERIAL\\_CERTIFIED}',
           INSPECTION_on_material_certified:'\\texttt{PRINT\\_COMPLETE}',
           CERTIFICATION_on_material_certified:'\\texttt{INSPECTION\\_PASSED}'};
const rows=[]; let tot=0, rej=0, ev=0, acc=0, lnk=0;
for(const [k,v] of Object.entries(d.conditions)){
  const [evt,stage]=NAME[k];
  P(`L.${k}.n`,v.n,`conditions.${k}.n`);
  P(`L.${k}.rejected`,v.rejected,`conditions.${k}.rejected`);
  P(`L.${k}.endorse_phase`,v.by_phase.endorse||0,`conditions.${k}.by_phase.endorse`);
  P(`L.${k}.lifecycle_assertion`,v.by_error_class.LIFECYCLE_ASSERTION||0,`conditions.${k}.by_error_class.LIFECYCLE_ASSERTION`);
  P(`L.${k}.prov_written`,v.ledger_walk.provenance_events_written,`conditions.${k}.ledger_walk.provenance_events_written`);
  P(`L.${k}.acc_incremented`,v.ledger_walk.accumulators_incremented,`conditions.${k}.ledger_walk.accumulators_incremented`);
  P(`L.${k}.link_written`,v.ledger_walk.link_entries_written,`conditions.${k}.ledger_walk.link_entries_written`);
  tot+=v.n; rej+=v.rejected;
  ev+=v.ledger_walk.provenance_events_written;
  acc+=v.ledger_walk.accumulators_incremented;
  lnk+=v.ledger_walk.link_entries_written;
  rows.push(`${evt} & ${REQ[k]} & ${stage} & ${v.n} & ${v.rejected} & ${v.ledger_walk.provenance_events_written} & ${v.ledger_walk.accumulators_incremented} & ${v.ledger_walk.link_entries_written} \\\\`);
}
const c=d.control;
P('L.total_n',tot,'sum of conditions.*.n');
P('L.total_rejected',rej,'sum of conditions.*.rejected');
P('L.total_ledger_writes',ev+acc+lnk,'sum of all three ledger_walk counters');
P('L.control_n',c.n,'control.n');
P('L.control_both',c.both_events_on_ledger,'control.both_events_on_ledger');
rows.push(`\\midrule`);
rows.push(`\\multicolumn{3}{@{}l}{\\emph{Control, in order}} & ${c.n} & 0 & \\multicolumn{3}{c}{${c.both_events_on_ledger}/${c.n} committed} \\\\`);
fs.writeFileSync(path.join(OUT,'lifecycle_assertion_body.tex'),rows.join('\n')+'\n');
const L=['SECTION 5 lifecycle assertion — number provenance','='.repeat(50),'',
 `Source: ${SRC}`,`run_id ${d.run_id}  channel ${d.channel}  chaincode ${d.chaincode}`,
 `started ${d.started_at}  finished ${d.finished_at}`,'',
 'Every submission goes through IntegrationContract:RecordProvenanceWithReputation',
 '(the bridge path). Rejection phase and class come from the gateway error: the',
 'chaincode message is read from e.details[].message, since the gateway top-level',
 'message is generic. LIFECYCLE_ASSERTION means the chaincode returned',
 '"invalid lifecycle transition: ...".',''];
for(const r of prov){L.push(`${r.k.padEnd(46)}= ${r.v}`);L.push(' '.repeat(48)+r.how);}
L.push('','Representative chaincode rejection messages (one per condition):');
for(const [k,v] of Object.entries(d.conditions)) L.push(`  ${k}:\n    ${v.trials[0].message}`);
fs.writeFileSync(path.join(OUT,'lifecycle_assertion_body.txt'),L.join('\n')+'\n');
console.log(rows.join('\n'));
console.log(`\ntotals: ${rej}/${tot} rejected, ${ev+acc+lnk} ledger writes, control ${c.both_events_on_ledger}/${c.n}`);
