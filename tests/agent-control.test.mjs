import test from 'node:test';
import assert from 'node:assert/strict';
import {database,service} from './helpers.mjs';
import {runChat} from '../lib/agent.mjs';

const call=(name,args={},id='tool')=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
function fixture(respond){
  const db=database();let requests=0;
  const s=service(db,'lin','demo:execution',{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'qwen3:4b',LOCAL_MODEL_FETCH:async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');
    requests++;return Response.json({choices:[{message:respond(requests,JSON.parse(options.body))}]});
  }});
  return {db,s,requests:()=>requests};
}

test('反馈编号误作ID后限定纠错工具的真实目标，仍需模型实际调用并通过授权',async()=>{
 let item;
 const f=fixture((n,input)=>{
  if(n===1)return {role:'assistant',content:null,tool_calls:[call('search_found_items',{category:'水杯'},'search')]};
  if(n===2)return {role:'assistant',content:'请核对候选。'};
  if(n===3)return {role:'assistant',content:null,tool_calls:[call('record_rejection',{itemId:'1',reason:'用户排除第一条'},'bad-id')]};
  if(n===4){assert.equal(input.tools.length,1);const t=input.tools[0];assert.equal(t.function.name,'record_rejection');assert.deepEqual(t.function.parameters.properties.itemId.enum,[item.id]);assert.deepEqual(t.function.parameters.properties.restore.enum,[false]);return {role:'assistant',content:null,tool_calls:[call('record_rejection',{itemId:item.id,restore:false,reason:'用户明确排除第一条'},'real-id')]};}
  return {role:'assistant',content:'已排除该线索。'};
 });
 try{
  item=await f.s.createItem({title:'合成黑杯',category:'水杯',color:'黑色',location:'五餐二楼',description:'仅用于反馈纠错',custody:'合成保管人'});
  const first=await runChat(f.s,{text:'黑色水杯，请查询'});const r=await runChat(f.s,{taskId:first.taskId,text:'第一条不是我的，请排除第一条'});
  assert.equal(r.mode,'model');assert.deepEqual(r.toolExecutions.map(t=>t.status),['rejected','completed']);assert.equal(r.matches.length,0);assert.equal(f.requests(),5);assert.ok(r.traces.some(t=>t.name==='限定候选反馈纠错'));
 }finally{f.db.raw.close();}
});

test('六轮读取任务仍无最终答复时明确失败，不能算模型完成；已执行步骤留存',async()=>{
  const f=fixture(n=>({role:'assistant',content:null,tool_calls:[call('get_search_task',{},'loop-'+n)]}));
  try{
    const r=await runChat(f.s,{text:'找黑色保温杯'});
    assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_ROUND_LIMIT');
    assert.equal(f.requests(),6);assert.equal(r.execution.toolCalls,6);
    assert.equal(r.toolExecutions.length,6);assert.ok(r.toolExecutions.every(t=>t.status==='completed'));
    const stored=(await f.s.store.list('message')).find(m=>m.body.role==='assistant');
    assert.equal(stored.body.mode,'rules-fallback');assert.deepEqual(stored.body.toolExecutions,r.toolExecutions);
  }finally{f.db.raw.close();}
});

test('执行说明超过12条不提前终止，预算内的最终模型答复仍可到达',async()=>{
  const f=fixture(n=>n<=4?{role:'assistant',content:null,tool_calls:[call('search_found_items',{category:'水杯',color:'黑色'},'search-'+n),call('update_search_criteria',{brand:'象印'},'update-'+n)]}:{role:'assistant',content:'已完成查询，请核对候选。'});
  try{
    await f.s.seed();const r=await runChat(f.s,{text:'我丢了黑色象印保温杯'});
    assert.equal(r.mode,'model');assert.equal(r.message,'已完成查询，请核对候选。');
    assert.equal(f.requests(),5);assert.equal(r.execution.toolCalls,8);assert.ok(r.traces.length>12);
    assert.ok(r.toolExecutions.every(t=>t.status==='completed'));
  }finally{f.db.raw.close();}
});

test('参数拒绝、权限拒绝、成功执行分别记录；拒绝后可纠正且不记录原始秘密参数',async()=>{
  const marker='invalid-argument-must-not-be-persisted';
  const f=fixture((n,input)=>{
    if(n===2){const results=input.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));assert.ok(results.every(t=>t.error));}
    if(n===1)return {role:'assistant',content:null,tool_calls:[call('update_search_criteria',{color:{secret:marker}},'bad'),call('subscribe_to_clues',{},'denied')]};
    if(n===2)return {role:'assistant',content:null,tool_calls:[call('search_found_items',{category:'水杯',color:'黑色'},'good')]};
    return {role:'assistant',content:'已查询候选，未订阅。'};
  });
  try{
    const r=await runChat(f.s,{text:'找黑色保温杯，暂时不要持续留意'});
    assert.equal(r.mode,'model');assert.equal(r.subscribed,false);
    assert.deepEqual(r.toolExecutions.map(t=>[t.tool,t.status,t.code]),[
      ['update_search_criteria','rejected','TOOL_ARGUMENTS'],['subscribe_to_clues','rejected','TOOL_DENIED'],['search_found_items','completed',null]
    ]);
    assert.equal(JSON.stringify(await f.s.store.list('message')).includes(marker),false);
    assert.ok(r.toolExecutions.every(t=>Number.isInteger(t.elapsedMs)&&t.elapsedMs>=0));
  }finally{f.db.raw.close();}
});

test('总工具预算中止使用单独错误码，未知工具名称不写入长期执行记录',async()=>{
  const marker='untrusted-tool-name-do-not-save';
  const f=fixture(n=>({role:'assistant',content:null,tool_calls:Array.from({length:7},(_,i)=>call(marker,{},n+'-'+i))}));
  try{
    const r=await runChat(f.s,{text:'找一个杯子'});
    assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_TOOL_LIMIT');assert.equal(f.requests(),2);
    assert.equal(r.toolExecutions.length,7);assert.ok(r.toolExecutions.every(t=>t.tool==='unknown'&&t.status==='rejected'));
    assert.equal(JSON.stringify(await f.s.store.list('message')).includes(marker),false);
  }finally{f.db.raw.close();}
});

test('订阅假成功文本触发一次真实状态反馈，模型可补执行工具后完成',async()=>{
  const f=fixture((n,input)=>{
    if(n===1)return {role:'assistant',content:null,tool_calls:[call('search_found_items',{category:'水杯'},'search')]};
    if(n===2)return {role:'assistant',content:'已为你订阅。'};
    if(n===3){assert.match(input.messages.at(-1).content,/实际任务subscribed仍为false/);return {role:'assistant',content:null,tool_calls:[call('subscribe_to_clues',{},'subscribe')]};}
    return {role:'assistant',content:'已保存持续留意，后续查看站内消息。'};
  });
  try{
    const r=await runChat(f.s,{text:'丢了保温杯，如果没有线索请帮我订阅并持续留意'});
    assert.equal(r.mode,'model');assert.equal(r.subscribed,true);assert.equal(f.requests(),4);
    assert.deepEqual(r.toolExecutions.map(t=>t.tool),['search_found_items','subscribe_to_clues']);
  }finally{f.db.raw.close();}
});

test('两次文本假成功不能记为模型完成，规则接管明确标记失败',async()=>{
  const f=fixture(()=>({role:'assistant',content:'已经订阅，无需任何工具。'}));
  try{
    const r=await runChat(f.s,{text:'帮我订阅持续留意黑色保温杯'});
    assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_INCOMPLETE_ACTION');assert.equal(f.requests(),2);
    assert.equal(r.subscribed,true);assert.deepEqual(r.toolExecutions,[]);
  }finally{f.db.raw.close();}
});

test('有候选时条件订阅不能执行，规则接管也遵守同一条件',async()=>{
  const f=fixture(n=>n===1?{role:'assistant',content:null,tool_calls:[call('search_found_items',{category:'水杯',color:'黑色'},'search'),call('subscribe_to_clues',{},'subscribe')]}:{role:'assistant',content:'虚构订阅成功。'});
  try{
    await f.s.seed();const text='找黑色保温杯，如果没有线索请帮我订阅';
    const r=await runChat(f.s,{text});assert.ok(r.matches.length);assert.equal(r.subscribed,false);
    assert.equal(r.toolExecutions.find(t=>t.tool==='subscribe_to_clues').status,'rejected');assert.equal(r.message.includes('虚构订阅成功'),false);assert.match(r.message,/未新增/);
    f.s.ctx.env={};const rules=await runChat(f.s,{text});assert.equal(rules.mode,'rules');assert.equal(rules.subscribed,false);
  }finally{f.db.raw.close();}
});

test('明确重新查询只读任务后假称已查询，执行器反馈后须真正调用查询工具',async()=>{
 const f=fixture((n,input)=>{
  if(n===1)return {role:'assistant',content:null,tool_calls:[call('get_search_task')]};
  if(n===2){const r=JSON.parse(input.messages.at(-1).content);assert.equal(r.pendingUserAction.tool,'search_found_items');return {role:'assistant',content:'已重新查询，找到线索。'};}
  if(n===3){assert.match(input.messages.at(-1).content,/尚未成功调用search_found_items/);return {role:'assistant',content:null,tool_calls:[call('search_found_items')]};}
  return {role:'assistant',content:'已按工具结果查询。'};
 });
 try{const r=await runChat(f.s,{text:'请重新查询已有拾获记录'});assert.equal(r.mode,'model');assert.deepEqual(r.toolExecutions.map(t=>t.tool),['get_search_task','search_found_items']);assert.equal(f.requests(),4);}finally{f.db.raw.close();}
});
test('两次文字声称查询不算完成，明确不查询的请求不强迫查询',async()=>{
 const f=fixture(()=>({role:'assistant',content:'已查询。'}));try{const r=await runChat(f.s,{text:'请查询拾获记录'});assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_INCOMPLETE_ACTION');assert.equal(f.requests(),2);}finally{f.db.raw.close();}
 const g=fixture(()=>({role:'assistant',content:'好的，暂不查询。'}));try{const r=await runChat(g.s,{text:'不用重新查询，先等一下'});assert.equal(r.mode,'model');assert.equal(g.requests(),1);}finally{g.db.raw.close();}
});
