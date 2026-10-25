import test from 'node:test';
import assert from 'node:assert/strict';
import {database,service} from './helpers.mjs';
import {runChat} from '../lib/agent.mjs';

test('executor asks for an ordinal after denied ambiguous model feedback without claiming model chose it',async()=>{
 const db=database();let count=0,target;
 const env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:async()=>{
  count++;
  const request=(name,args)=>({role:'assistant',content:null,tool_calls:[{id:'fixture-'+count,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
  const message=count===1?{role:'assistant',content:'有两条候选。'}:count===2?request('record_rejection',{itemId:target,reason:'猜测第一条'}):count===4?request('get_search_task',{}):count===5?request('record_rejection',{itemId:target,reason:'用户明确排除第一条'}):{role:'assistant',content:'已经排除了。'};
  return Response.json({choices:[{message}]});
 }};
 const s=service(db,'lin','demo:clarification',env),holder=service(db,'zhou','demo:clarification',env);
 try{
  for(const title of ['合成黑杯甲','合成黑杯乙'])await holder.createItem({title,description:'合成测试',category:'水杯',color:'黑色',location:'五餐二楼',custody:'合成保管人'});
  const first=await runChat(s,{text:'五餐二楼丢了黑色水杯'});target=first.matches[0].item.id;
  const result=await runChat(s,{text:'这条不是我的',taskId:first.taskId});
  assert.equal(result.mode,'model');assert.match(result.question,/第几条/);assert.equal(result.matches.length,2);
  assert.equal((await s.store.list('feedback')).length,0);assert.equal(result.toolExecutions[0].status,'rejected');
  assert.equal(result.toolExecutions.some(t=>t.tool==='ask_clarifying_question'),false);
  assert.ok(result.traces.some(t=>t.name==='执行器补充澄清'));
  assert.equal(result.message.includes('已经排除了'),false);
  assert.match(result.question,/排除第1条/);
  const confirmed=await runChat(s,{text:'排除第1条',taskId:first.taskId});
  assert.equal(confirmed.mode,'model');assert.equal(confirmed.matches.length,1);
  assert.equal((await s.store.list('feedback')).length,1);
  assert.ok(confirmed.toolExecutions.some(t=>t.tool==='record_rejection'&&t.status==='completed'));
 }finally{db.raw.close();}
});
