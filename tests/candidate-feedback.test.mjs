import test from 'node:test';
import assert from 'node:assert/strict';
import {database,service} from './helpers.mjs';
import {runChat} from '../lib/agent.mjs';
import {candidateFeedbackIntent,candidateFeedbackContext} from '../lib/candidate-feedback.mjs';
const call=(name,args={})=>({role:'assistant',content:null,tool_calls:[{id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]});
function model(s,respond){let n=0;s.ctx.env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture-only',LOCAL_MODEL_FETCH:async(url,options)=>Response.json({choices:[{message:await respond(++n,JSON.parse(options.body))}]})};}

test('反馈意图区分拒绝操作、地点更正、举例与真实排除/恢复请求',()=>{
  for(const text of ['先不要排除这条','别把第一条排除了','我没让你排除','不是要排除第一条','不要恢复第一条','不是二楼，是三楼','如果不是我的该怎么排除','杯子上写着不是我的','如何恢复候选','排除第一条会怎样'])assert.equal(candidateFeedbackIntent(text),null,text);
  for(const text of ['第一条不是我的','这条不是我丢的','请排除第2条'])assert.equal(candidateFeedbackIntent(text),'reject',text);
  for(const text of ['恢复刚才排除的那条','请撤销排除','恢复第1条'])assert.equal(candidateFeedbackIntent(text),'restore',text);
});

test('即使模型误发排除工具，明确拒绝与楼层更正也不能修改反馈',async()=>{
  for(const text of ['先不要排除这条，我还没确定','不是二楼，是三楼','杯子上写着不是我的']){
    const db=database(),s=service(db);
    try{
      await s.seed();const first=await runChat(s,{text:'五餐二楼丢了黑色保温杯'});
      model(s,n=>n===1?call('record_rejection',{itemId:first.matches[0].item.id,reason:'模型误判'}):{role:'assistant',content:'假装排除成功。'});
      const r=await runChat(s,{taskId:first.taskId,text});
      assert.equal((await s.store.list('feedback')).length,0,text);assert.equal(r.toolExecutions[0].status,'rejected');
      assert.match(r.message,/未执行/);assert.equal(r.message.includes('假装排除成功'),false);
      if(text.startsWith('不是二楼'))assert.deepEqual(r.criteria.locationInfo.places[0].floors,[3]);
    }finally{db.raw.close();}
  }
});

test('读取任务提供实际公开编号，模型选错用户指定编号时拒绝修改',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'});assert.equal(first.matches.length,2);
    model(s,(n,input)=>{
      if(n===1)return call('get_search_task');
      if(n===2){const context=JSON.parse(input.messages.at(-1).content).feedbackContext;assert.deepEqual(context.displayed.map(c=>c.id),first.matches.map(m=>m.item.id));assert.equal(JSON.stringify(context).includes('privateNote'),false);assert.equal(JSON.stringify(context).includes('contact'),false);return call('record_rejection',{itemId:first.matches[1].item.id,reason:'选错目标'});}
      return {role:'assistant',content:'没有更改，请核对第一条。'};
    });
    const r=await runChat(s,{taskId:first.taskId,text:'第一条不是我的，请排除'});
    assert.equal((await s.store.list('feedback')).length,0);assert.equal(r.toolExecutions[1].status,'rejected');
  }finally{db.raw.close();}
});

test('规则模式可追问模糊目标、按编号排除并恢复，不把规则操作记为模型工具',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'});
    const ambiguous=await runChat(s,{taskId:first.taskId,text:'这条不是我的'});
    assert.equal((await s.store.list('feedback')).length,0);assert.match(ambiguous.question,/对象不明确/);
    const removed=await runChat(s,{taskId:first.taskId,text:'请排除第一条'});assert.equal(removed.matches.length,1);
    const restored=await runChat(s,{taskId:first.taskId,text:'恢复刚才排除的那条'});
    assert.equal(restored.matches.length,2);assert.equal(restored.mode,'rules');assert.equal(restored.execution.modelRequests,0);assert.deepEqual(restored.toolExecutions,[]);
    assert.equal((await s.store.list('feedback'))[0].body.restored,true);assert.equal(restored.criteria.color,'黑色');
  }finally{db.raw.close();}
});

test('模型可读取已排除的公开上下文并执行恢复，不能直接更改归还状态',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'});
    await s.feedback({taskId:first.taskId,itemId:first.matches[0].item.id});
    model(s,(n,input)=>{
      if(n===1)return call('get_search_task');
      if(n===2){const excluded=JSON.parse(input.messages.at(-1).content).feedbackContext.excluded;assert.equal(excluded.length,1);assert.equal(excluded[0].id,first.matches[0].item.id);return call('record_rejection',{itemId:excluded[0].id,reason:'用户确认误排除',restore:true});}
      return {role:'assistant',content:'已恢复，请继续核对公开特征。'};
    });
    const r=await runChat(s,{taskId:first.taskId,text:'请恢复刚才排除的那条'});
    assert.equal(r.mode,'model');assert.equal(r.matches.length,2);assert.equal(r.toolExecutions[1].status,'completed');
    assert.equal((await s.item(first.matches[0].item.id)).body.status,'available');
  }finally{db.raw.close();}
});

test('已恢复后最终模型答复故障，规则降级不重复执行同一反馈',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'});const id=first.matches[0].item.id;await s.feedback({taskId:first.taskId,itemId:id});
    const saved=s.feedback.bind(s);let mutations=0;s.feedback=async data=>{mutations++;return saved(data);};
    model(s,n=>{if(n===1)return call('record_rejection',{itemId:id,reason:'恢复误排除',restore:true});throw new Error('合成连接失败');});
    const r=await runChat(s,{taskId:first.taskId,text:'恢复刚才排除的那条'});
    assert.equal(r.mode,'rules-fallback');assert.equal(mutations,1);assert.equal(r.matches.length,2);assert.match(r.message,/已恢复/);
  }finally{db.raw.close();}
});

test('其他任务的排除记录不进入当前任务上下文，不能跨任务恢复',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'});const id=first.matches[0].item.id;await s.feedback({taskId:first.taskId,itemId:id});
    const second=await runChat(s,{text:'黑色保温杯'});
    assert.deepEqual((await candidateFeedbackContext(s,await s.task(second.taskId))).excluded,[]);
    model(s,n=>n===1?call('record_rejection',{itemId:id,restore:true,reason:'越过任务'}):{role:'assistant',content:'当前任务没有可恢复线索。'});
    const r=await runChat(s,{taskId:second.taskId,text:'恢复第一条'});assert.equal(r.toolExecutions[0].status,'rejected');
    assert.equal((await s.store.list('feedback'))[0].body.restored,false);
  }finally{db.raw.close();}
});

test('已找回或取消的任务不能经对话或反馈接口继续排除/恢复，历史不增加',async()=>{
  for(const status of ['found','cancelled']){
    const db=database(),s=service(db);
    try{
      await s.seed();const first=await runChat(s,{text:'黑色保温杯'});const id=first.matches[0].item.id;
      await s.feedback({taskId:first.taskId,itemId:id});const task=await s.task(first.taskId);await s.store.save(task,{...task.body,status});
      const count=(await s.store.list('message')).length;
      await assert.rejects(()=>runChat(s,{taskId:task.id,text:'恢复刚才排除的那条'}),{status:409});
      await assert.rejects(()=>s.feedback({taskId:task.id,itemId:id,restore:true}),{status:409});
      assert.equal((await s.store.list('message')).length,count);assert.equal((await s.store.list('feedback'))[0].body.restored,false);
    }finally{db.raw.close();}
  }
});

test('模型只读取后冒称排除完成时，执行器反馈遗漏并允许补执行',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'}),target=first.matches[0].item.id;
    model(s,(n,input)=>{
      if(n===1)return call('get_search_task');
      if(n===2)return {role:'assistant',content:'已排除第一条。'};
      if(n===3){assert.match(input.messages.at(-1).content,/候选反馈尚未保存/);assert.deepEqual(input.tools.map(t=>t.function.name),['record_rejection']);return call('record_rejection',{itemId:target,reason:'用户明确要求第一条'});}
      return {role:'assistant',content:'已排除，请核对剩余候选。'};
    });
    const r=await runChat(s,{taskId:first.taskId,text:'请排除第一条'});
    assert.equal(r.mode,'model');assert.equal(r.execution.modelRequests,4);assert.equal(r.matches.some(m=>m.item.id===target),false);
    assert.equal((await s.store.list('feedback')).length,1);assert.equal(r.toolExecutions.at(-1).tool,'record_rejection');
  }finally{db.raw.close();}
});

test('持续冒称反馈完成时明确模型失败，由规则按原候选编号接管一次',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'}),target=first.matches[0].item.id;
    model(s,()=>({role:'assistant',content:'已排除第一条。'}));
    const r=await runChat(s,{taskId:first.taskId,text:'请排除第一条'});
    assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_INCOMPLETE_ACTION');assert.equal(r.execution.modelRequests,2);
    assert.equal(r.matches.some(m=>m.item.id===target),false);assert.equal((await s.store.list('feedback')).length,1);assert.deepEqual(r.toolExecutions,[]);
  }finally{db.raw.close();}
});

test('误排除恢复也核对真实反馈状态，不能只用文本冒称恢复',async()=>{
  const db=database(),s=service(db);
  try{
    await s.seed();const first=await runChat(s,{text:'黑色保温杯'}),target=first.matches[0].item.id;
    await runChat(s,{taskId:first.taskId,text:'排除第一条'});
    model(s,(n,input)=>{
      if(n===1)return {role:'assistant',content:'已经恢复了。'};
      if(n===2){assert.match(input.messages.at(-1).content,/候选反馈尚未保存/);return call('record_rejection',{itemId:target,reason:'用户确认误排除',restore:true});}
      return {role:'assistant',content:'已恢复线索，请核对候选。'};
    });
    const r=await runChat(s,{taskId:first.taskId,text:'恢复刚才排除的那条'});
    assert.equal(r.mode,'model');assert.equal(r.matches.some(m=>m.item.id===target),true);
    assert.equal((await s.store.list('feedback'))[0].body.restored,true);assert.equal(r.execution.modelRequests,3);
  }finally{db.raw.close();}
});

test('模型猜错候选ID后获得用户授权目标提示，可重新调用且只修改正确候选',async()=>{
 const db=database(),s=service(db);
 try{
  await s.seed();const first=await runChat(s,{text:'黑色保温杯'}),target=first.matches[0].item.id;
  model(s,(n,input)=>{
   if(n===1)return call('record_rejection',{itemId:'1',reason:'错误地把编号当ID'});
   if(n===2){const denied=JSON.parse(input.messages.at(-1).content);assert.ok(denied.error);assert.equal(denied.pendingUserAction.arguments.itemId,target);return call('record_rejection',denied.pendingUserAction.arguments);}
   return {role:'assistant',content:'已按核对后的真实候选执行排除。'};
  });
  const r=await runChat(s,{taskId:first.taskId,text:'请排除第一条'});
  assert.equal(r.mode,'model');assert.deepEqual(r.toolExecutions.map(t=>t.status),['rejected','completed']);assert.equal(r.matches.some(m=>m.item.id===target),false);assert.equal(r.message.includes('未执行'),false);
  const feedback=await s.store.list('feedback');assert.equal(feedback.length,1);assert.equal(feedback[0].body.itemId,target);
 }finally{db.raw.close();}
});
