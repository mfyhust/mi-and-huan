import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseSearch} from '../lib/search-diagnostics.mjs';
import {extract,rank} from '../lib/matching.mjs';
import {runChat} from '../lib/agent.mjs';
import {handleApi} from '../lib/service.mjs';
import {database,service} from './helpers.mjs';
const row=(id,patch={})=>({id,owner:'synthetic-holder',body:{category:'水杯',color:'蓝色',brand:'象印',location:'五餐二楼',description:'合成杯',status:'available',...patch}});

test('区分无可认领记录、没有同类记录、全部排除与同类已排除',()=>{
 const c={category:'水杯',color:'黑色'};
 assert.equal(diagnoseSearch(c,[]).status,'no_records');
 assert.equal(diagnoseSearch(c,[row('a',{status:'returned'})]).status,'no_records');
 assert.equal(diagnoseSearch(c,[row('a',{category:'书本'})]).status,'no_category');
 assert.equal(diagnoseSearch(c,[row('a')],['a']).status,'all_excluded');
 assert.equal(diagnoseSearch(c,[row('a'),row('book',{category:'书本'})],['a']).status,'category_excluded');
});

test('单项解除检查仅返回建议，原条件、拾获记录、排名和私密字段均不改动或泄露',()=>{
 const c={category:'水杯',color:'黑色',brand:'象印'},items=[row('a',{privateNote:'secret-proof',contact:'secret-contact'})];
 const before=JSON.stringify({c,items});const d=diagnoseSearch(c,items);
 assert.equal(d.status,'criteria_blocked');assert.deepEqual(d.suggestions.map(s=>s.field),['color']);
 assert.equal(d.suggestions[0].candidateCount,1);assert.equal(d.changesApplied,false);
 assert.equal(JSON.stringify({c,items}),before);assert.equal(rank(c,items).length,0);
 assert.equal(JSON.stringify(d).includes('secret-'),false);assert.equal('items' in d,false);
});

test('两项同时冲突不假称只解除一项就能找到，不建议改类别',()=>{
 const d=diagnoseSearch({category:'水杯',color:'黑色',brand:'小米'},[row('a')]);
 assert.equal(d.status,'no_match');assert.equal(d.suggestions.length,0);
 assert.equal(diagnoseSearch({category:'书本',color:'黑色'},[row('a')]).suggestions.length,0);
});

test('已有候选时不诱导放宽条件；可能、忘记和明确排除字段不生成解除建议',()=>{
 assert.equal(diagnoseSearch({category:'水杯'},[row('a')]).status,'matches');
 for(const text of ['水杯，可能黑色','水杯，颜色记不清','水杯，不是蓝色']){
  const c=extract(text);assert.equal(diagnoseSearch(c,[row('a')]).suggestions.some(s=>s.field==='color'),false,text);
 }
});

test('只检查当前未排除待认领记录；候选上限如实标注“至少”',()=>{
 const c={category:'水杯',color:'黑色'};
 assert.equal(diagnoseSearch(c,[row('a'),row('book',{category:'书本'})],['a']).suggestions.length,0);
 const d=diagnoseSearch(c,Array.from({length:9},(_,i)=>row('item-'+i)));
 assert.equal(d.suggestions[0].candidateCount,6);assert.equal(d.suggestions[0].atLeast,true);assert.match(d.suggestions[0].explanation,/至少6/);
});

for(const edition of ['api','local'])test(edition+' 模拟模型：读诊断不写条件，误清空被拒，用户明确忘记后再检索',async()=>{
 const db=database(),original=globalThis.fetch;let n=0;let toolDiagnosis;
 const transport=async(url,options)=>{
  n++;const input=JSON.parse(options.body);
  if(n===2){toolDiagnosis=JSON.parse(input.messages.at(-1).content).searchDiagnostics;assert.equal(toolDiagnosis.status,'criteria_blocked');}
  const tools={1:['get_search_task',{}],2:['update_search_criteria',{color:''}],4:['search_found_items',{category:'水杯',color:'黑色'}]};
  const message=tools[n]?{role:'assistant',content:null,tool_calls:[{id:'diag-'+n,type:'function',function:{name:tools[n][0],arguments:JSON.stringify(tools[n][1])}}]}:{role:'assistant',content:'请核对颜色是否准确，条件未擅自更改。'};
  return Response.json({choices:[{message}]});
 };
 globalThis.fetch=transport;
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic-only'};
 const s=service(db,'lin','demo:diagnostics',env),h=service(db,'zhou','demo:diagnostics',env);
 try{
  const item=await h.createItem({title:'合成蓝杯',category:'水杯',color:'蓝色',brand:'象印',location:'五餐二楼',description:'合成记录',custody:'合成保管人'});
  const a=await runChat(s,{text:'象印黑色水杯'});
  assert.equal(a.mode,'model');assert.equal(a.matches.length,0);assert.equal(a.criteria.color,'黑色');
  assert.equal(a.searchDiagnostics.status,'criteria_blocked');assert.equal((await s.task(a.taskId)).body.criteria.color,'黑色');
  assert.equal((await s.store.list('claim')).length,0);assert.equal((await s.task(a.taskId)).body.subscribed,false);
  const b=await runChat(s,{taskId:a.taskId,text:a.searchDiagnostics.suggestions[0].prompt});
  assert.equal(b.mode,'model');assert.equal(b.criteria.clueHints.color.state,'unknown');assert.equal(b.matches[0].item.id,item.id);assert.equal(b.searchDiagnostics.status,'matches');
  const res=await handleApi(new Request('http://localhost/api/chat/history?taskId='+encodeURIComponent(a.taskId)),s);
  const history=(await res.json()).messages.filter(m=>m.role==='assistant');
  assert.equal(history[0].searchDiagnostics.status,'criteria_blocked');assert.equal(history[0].historical,true);assert.equal(history[1].searchDiagnostics.status,'matches');
 }finally{globalThis.fetch=original;db.raw.close();}
});

test('规则流程的诊断建议可执行，未点击或拒绝建议时保留原条件',async()=>{
 const db=database(),s=service(db),h=service(db,'zhou');
 try{
  await h.createItem({title:'蓝杯',category:'水杯',color:'蓝色',location:'五餐二楼',description:'合成记录',custody:'本人'});
  const a=await runChat(s,{text:'黑色水杯'});assert.equal(a.searchDiagnostics.status,'criteria_blocked');
  const b=await runChat(s,{taskId:a.taskId,text:'颜色确定无误，先保持原条件'});assert.equal(b.criteria.color,'黑色');assert.equal(b.matches.length,0);
  const c=await runChat(s,{taskId:a.taskId,text:a.searchDiagnostics.suggestions[0].prompt});assert.equal(c.matches.length,1);assert.equal(c.criteria.clueHints.color.state,'unknown');
 }finally{db.raw.close();}
});

test('诊断按用户空间隔离，不把别人的拾获或反馈算入当前任务',async()=>{
 const db=database(),s=service(db),other=service(db,'zhou','another-space');
 try{
  await other.createItem({title:'蓝杯',category:'水杯',color:'蓝色',location:'五餐二楼',description:'合成记录',custody:'本人'});
  const a=await runChat(s,{text:'黑色水杯'});assert.equal(a.searchDiagnostics.status,'no_records');assert.equal(a.searchDiagnostics.availableRecords,0);
 }finally{db.raw.close();}
});
