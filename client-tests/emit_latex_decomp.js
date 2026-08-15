'use strict';
/*
 * emit_latex_decomp.js — Section 5.2 latency decomposition fragment.
 * Phase-split medians measured directly by the harness, not attributed.
 * NO NUMBER TYPED BY HAND. Usage: node emit_latex_decomp.js [outdir]
 */
const fs=require('fs'), path=require('path');
const R='am-unified/results';
const P8=path.join(R, fs.readdirSync(R).find(d=>d.startsWith('phase8-')));
const OUT=process.argv[2]||path.join(R,'latex_fragments');
const a=JSON.parse(fs.readFileSync(path.join(P8,'analysis.json'),'utf8')).per_condition;
const f=(v,d=1)=>v==null?'n/a':Number(v).toFixed(d);
const prov=[];
const P=(k,v,src,how)=>{prov.push({k,v,src,how});return v;};
const NAME={A:'Provenance write',B:'Reputation write',C:'Bridge write (atomic)'};
const rows=[];
for(const c of ['A','B','C']){
  const m=a[c].median_across_runs;
  const e=P(`D.${c}.endorse_median_ms`,m.endorse_median,'phase8/analysis.json',`per_condition.${c}.median_across_runs.endorse_median`);
  const o=P(`D.${c}.order_commit_median_ms`,m.order_commit_median,'phase8/analysis.json',`per_condition.${c}.median_across_runs.order_commit_median`);
  const t=P(`D.${c}.p50_total_ms`,m.p50,'phase8/analysis.json',`per_condition.${c}.median_across_runs.p50`);
  P(`D.${c}.sum_check_ms`,e+o,'(derived)','endorse_median + order_commit_median, to be compared against p50');
  rows.push(`${NAME[c]} & ${f(e,1)} & ${f(o,1)} & ${f(t,1)} \\\\`);
}
fs.writeFileSync(path.join(OUT,'latency_decomposition_body.tex'),rows.join('\n')+'\n');
const L=['SECTION 5.2 latency decomposition — number provenance','='.repeat(54),'',
 'Source: '+path.join(P8,'analysis.json'),
 'computed by analyze.js from txs.jsonl only. The harness timestamps three phase',
 'boundaries per transaction from a monotonic clock, so endorsement and',
 'order+commit are measured, not inferred from the total.',''];
for(const r of prov){L.push(`${r.k.padEnd(32)}= ${f(r.v,2)}`);L.push(' '.repeat(34)+r.src);L.push(' '.repeat(34)+r.how);}
L.push('','Closure check (endorse + order_commit vs measured P50):');
for(const c of ['A','B','C']){const m=a[c].median_across_runs;
  L.push(`  ${NAME[c].padEnd(24)} ${f(m.endorse_median,2)} + ${f(m.order_commit_median,2)} = ${f(m.endorse_median+m.order_commit_median,2)}  vs P50 ${f(m.p50,2)}`);}
fs.writeFileSync(path.join(OUT,'latency_decomposition_body.txt'),L.join('\n')+'\n');
console.log(rows.join('\n'));
