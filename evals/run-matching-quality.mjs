import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as current from '../lib/matching.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const row=(id,patch={})=>({id,owner:'synthetic-holder',body:{category:'水杯',color:'黑色',brand:'象印',date:'2026-10-21',location:'五餐二楼',description:'合成杯',status:'available',...patch}});
// Fixed engineering diagnostics, deliberately containing the changed failure modes.
// These are not held-out real users or a statistical model benchmark.
export const rankingCases=[
 {id:'range-versus-before-loss',text:'水杯，2026-10-20到2026-10-22',items:[row('a-before',{date:'2026-10-19'}),row('b-inside',{date:'2026-10-21'})],expected:'b-inside'},
 {id:'single-day-causal-order',text:'水杯，2026-10-21',items:[row('a-before',{date:'2026-10-20'}),row('b-after',{date:'2026-10-22'})],expected:'b-after'},
 {id:'confirmed-color-control',text:'黑色水杯',items:[row('a-white',{color:'白色'}),row('b-black')],expected:'b-black'},
 {id:'partial-record-control',text:'象印黑色水杯',items:[row('a-sparse',{color:'',brand:''}),row('b-complete')],expected:'b-complete'}
];
const matches=patches=>patches.map((patch,i)=>({item:row('candidate-'+i,patch)}));
export const questionCases=[
 {id:'color-more-informative',criteria:{category:'水杯'},matches:matches([{brand:'象印',color:'黑色'},{brand:'象印',color:'黑色'},{brand:'象印',color:'蓝色'},{brand:'小米',color:'蓝色'}]),expected:'color'},
 {id:'missing-brand-records',criteria:{category:'水杯'},matches:matches([{brand:'象印',color:'黑色'},{brand:'小米',color:'蓝色'},{brand:'',color:'绿色'},{brand:'',color:'白色'}]),expected:'color'},
 {id:'brand-more-informative-control',criteria:{category:'水杯'},matches:matches([{brand:'象印'},{brand:'小米'},{brand:'富光'},{brand:'华为',color:'蓝色'}]),expected:'brand'},
 {id:'forgotten-brand-control',criteria:{category:'水杯',clueHints:{brand:{state:'unknown',options:[]}}},matches:matches([{brand:'象印',color:'黑色'},{brand:'小米',color:'蓝色'}]),expected:'color'}
];
export function measure(module){
 const ranking=rankingCases.map(c=>{const result=module.rank(module.extract(c.text),c.items);return {id:c.id,expected:c.expected,actual:result[0]?.item.id||null,passed:result[0]?.item.id===c.expected,order:result.map(m=>m.item.id)};});
 const questions=questionCases.map(c=>{const q=module.nextQuestion(c.criteria,c.matches);return {id:c.id,expected:c.expected,actual:q?.field||null,passed:q?.field===c.expected,question:q?.text||null};});
 return {ranking:{passed:ranking.filter(c=>c.passed).length,total:ranking.length,cases:ranking},questions:{passed:questions.filter(c=>c.passed).length,total:questions.length,cases:questions}};
}
const hashes=root=>Object.fromEntries(['lib/matching.mjs','lib/time-clues.mjs','lib/agent.mjs','lib/service.mjs'].filter(p=>existsSync(resolve(root,p))).map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
export async function main(args=process.argv.slice(2)){
 const value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
 const baseline=value('--baseline'),output=value('--output');
 if(output&&existsSync(resolve(output)))throw new Error('输出已存在；不覆盖历史报告。');
 const report={kind:'fixed-synthetic-engineering-diagnostics',realModelInference:false,limitations:['hand-picked development cases','not an independent test set','not real-user accuracy','not proof of local-model offline acceptance'],current:{sourceHashes:hashes(ROOT),...measure(current)}};
 if(baseline){const root=resolve(baseline);report.baseline={sourceHashes:hashes(root),...measure(await import(pathToFileURL(resolve(root,'lib/matching.mjs')).href))};}
 if(output)writeFileSync(resolve(output),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(['baseline','current'].filter(k=>report[k]).map(k=>[k,{ranking:`${report[k].ranking.passed}/${report[k].ranking.total}`,questionSelection:`${report[k].questions.passed}/${report[k].questions.total}`}]))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
