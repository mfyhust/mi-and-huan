import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveModelConfig,completeModel,testModelConnection} from '../lib/model-runtime.mjs';
import {database,service} from './helpers.mjs';
import {handleApi} from '../lib/service.mjs';
import {runChat} from '../lib/agent.mjs';
const env={LLM_PROVIDER:'sjtu',LLM_MODEL:'deepseek-chat',LLM_API_KEY:'server-test-secret'};
const post=(s,path,body)=>handleApi(new Request('http://localhost/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),s);

test('显式配置来源不会静默覆盖用户选择；规则模式不请求模型，密钥与供应商配套',async()=>{
  const server=resolveModelConfig(env,{source:'server',provider:'deepseek',model:'other',key:'page-secret'});assert.equal(server.key,env.LLM_API_KEY);assert.equal(server.provider,'sjtu');
  const session=resolveModelConfig(env,{source:'session',provider:'deepseek',model:'custom-model',key:'page-secret'});assert.equal(session.key,'page-secret');assert.equal(session.provider,'deepseek');assert.equal(session.model,'custom-model');
  assert.throws(()=>resolveModelConfig(env,{source:'session',provider:'deepseek',key:''}),{status:400});assert.throws(()=>resolveModelConfig({},{source:'server'}),{status:400});
  for(const bad of [{source:'unknown'},{model:{}},{provider:[]},{key:{}},{key:'secret\nheader'},{model:'x'.repeat(121)}])assert.throws(()=>resolveModelConfig({},bad),{status:400});
  const db=database(),s=service(db,'lin','demo:rules',env),saved=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('禁止外发');};
  try{const result=await runChat(s,{text:'五餐二楼丢了黑色保温杯',llm:{source:'rules'}});assert.equal(result.mode,'rules');assert.equal(result.execution.modelRequests,0);assert.equal(calls,0);assert.equal((await post(s,'model/test',null)).status,400);assert.equal((await post(s,'model/test',[])).status,400);assert.equal(result.criteria.locationInfo.places[0].id,'sjtu-mh:dining:5');}
  finally{globalThis.fetch=saved;db.raw.close();}
});

test('模型HTTP错误分型，忽略包含密钥的上游正文，不自动重试',async()=>{
  const saved=globalThis.fetch;
  try{
    for(const [status,code] of [[401,'MODEL_AUTH'],[403,'MODEL_FORBIDDEN'],[402,'MODEL_BALANCE'],[404,'MODEL_NOT_FOUND'],[429,'MODEL_RATE_LIMIT'],[503,'MODEL_UNAVAILABLE']]){
      let calls=0;globalThis.fetch=async()=>{calls++;return new Response('server-test-secret upstream debug',{status});};
      await assert.rejects(()=>completeModel(resolveModelConfig(env),[]),e=>{assert.equal(e.code,code);assert.equal(e.message.includes('server-test-secret'),false);return true;});assert.equal(calls,1);
    }
    globalThis.fetch=async()=>{throw new Error('secret in connection detail: server-test-secret');};await assert.rejects(()=>completeModel(resolveModelConfig(env),[]),e=>e.code==='MODEL_NETWORK'&&!e.message.includes('server-test-secret'));
  }finally{globalThis.fetch=saved;}
});

test('拦截错误JSON、空答复、异常协议、超大响应与截断；保留有效文本块和供应商用量',async()=>{
  const saved=globalThis.fetch;
  const cases=[['not-json','MODEL_INVALID_JSON'],[{choices:[]},'MODEL_PROTOCOL'],[{choices:[{message:{role:'assistant',content:''}}]},'MODEL_PROTOCOL'],[{choices:[{message:{role:'user',content:'bad'}}]},'MODEL_PROTOCOL'],[{choices:[{message:{role:'assistant',content:'partial'},finish_reason:'length'}]},'MODEL_TRUNCATED'],[{choices:[{message:{role:'assistant',content:null,tool_calls:{}}}]},'MODEL_PROTOCOL']];
  try{
    for(const [body,code] of cases){globalThis.fetch=async()=>typeof body==='string'?new Response(body):Response.json(body);await assert.rejects(()=>completeModel(resolveModelConfig(env),[]),{code});}
    globalThis.fetch=async()=>new Response('x',{headers:{'content-length':String(3*1024*1024)}});await assert.rejects(()=>completeModel(resolveModelConfig(env),[]),{code:'MODEL_RESPONSE_TOO_LARGE'});
    globalThis.fetch=async()=>new Response('x'.repeat(2*1024*1024+1));await assert.rejects(()=>completeModel(resolveModelConfig(env),[]),{code:'MODEL_RESPONSE_TOO_LARGE'});
    globalThis.fetch=async()=>Response.json({choices:[{message:{role:'assistant',content:[{type:'text',text:'有效答复'}],untrusted_extra:'discard'}}],usage:{prompt_tokens:9,completion_tokens:3}});
    const result=await completeModel(resolveModelConfig(env),[]);assert.equal(result.message.content,'有效答复');assert.equal(result.message.untrusted_extra,undefined);assert.deepEqual(result.usage,{inputTokens:9,outputTokens:3});
  }finally{globalThis.fetch=saved;}
});

test('主动连接检查使用合成消息、验证真实工具参数，不创建寻物任务或发送私密记录',async()=>{
  const db=database(),s=service(db,'lin','demo:diagnostic',env),saved=globalThis.fetch;let calls=0;
  await s.store.add('item','holder',{title:'私有测试物品',privateNote:'不得进入诊断的私密特征',pickupCode:'999999',status:'available'});
  globalThis.fetch=async(url,options)=>{
    calls++;assert.equal(url,'https://models.sjtu.edu.cn/api/v1/chat/completions');const input=JSON.parse(options.body);assert.equal(options.headers.authorization,'Bearer server-test-secret');assert.equal(JSON.stringify(input).includes('私密特征'),false);assert.equal(JSON.stringify(input).includes('999999'),false);
    const token=input.messages.at(-1).content;return Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'probe',type:'function',function:{name:'connection_probe',arguments:JSON.stringify({token})}}]}}],usage:{prompt_tokens:5,completion_tokens:6}});
  };
  try{
    const response=await post(s,'model/test',{llm:{source:'server'}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.connected,true);assert.equal(result.toolCalling,true);assert.equal(calls,1);
    assert.equal((await s.store.list('task')).length,0);assert.equal((await s.store.list('message')).length,0);assert.equal(JSON.stringify(await s.store.list('model_check')).includes('server-test-secret'),false);
    assert.equal((await post(s,'model/test',{llm:{source:'server'}})).status,429);assert.equal(calls,1);
    const denied=await handleApi(new Request('http://localhost/api/model/test',{method:'POST',headers:{origin:'https://other.invalid'},body:'{}'}),s);assert.equal(denied.status,403);
  }finally{globalThis.fetch=saved;db.raw.close();}
});

test('普通文本答复不冒充工具通过；离线连接检查不接触云模型或旧服务端密钥',async()=>{
  const saved=globalThis.fetch,local={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'qwen3:8b',LLM_API_KEY:'never-forward'};let calls=0;
  try{
    globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');assert.equal(options.headers.authorization,undefined);return Response.json({choices:[{message:{role:'assistant',content:'连接成功'}}]});};
    const result=await testModelConnection(local);assert.equal(result.connected,true);assert.equal(result.toolCalling,false);assert.equal(result.code,'MODEL_TOOLS_UNCONFIRMED');
    await assert.rejects(()=>testModelConnection(local,{source:'session',key:'external'}),{status:400});assert.equal(calls,1);
    const db=database(),s=service(db,'lin','demo:local',local);try{assert.equal((await post(s,'model/test',{llm:{provider:'sjtu'}})).status,400);assert.equal((await s.store.list('model_check')).length,0);}finally{db.raw.close();}
  }finally{globalThis.fetch=saved;}
});

test('模型失败原因与已确认条件保存在历史中，规则结果可继续使用',async()=>{
  const db=database(),s=service(db,'lin','demo:model-failure',env),saved=globalThis.fetch;globalThis.fetch=async()=>new Response('secret',{status:429});
  try{await s.seed();const result=await runChat(s,{text:'五餐二楼黑色保温杯',llm:{source:'server'}});assert.equal(result.mode,'rules-fallback');assert.equal(result.modelErrorCode,'MODEL_RATE_LIMIT');assert.deepEqual(result.criteria.locationInfo.places[0].floors,[2]);
    const response=await handleApi(new Request('http://localhost/api/chat/history?taskId='+encodeURIComponent(result.taskId)),s);const history=await response.json();assert.equal(history.messages.at(-1).modelErrorCode,'MODEL_RATE_LIMIT');assert.equal(history.messages.at(-1).modelError.includes('secret'),false);
  }finally{globalThis.fetch=saved;db.raw.close();}
});

test('排除/恢复立即返回新候选并保存对话，历史与排除列表不泄露私密特征',async()=>{
  const db=database(),s=service(db);try{
    await s.seed();const initial=await runChat(s,{text:'黑色保温杯'}),id=initial.matches[0].item.id;
    const rejected=await post(s,'feedback',{taskId:initial.taskId,itemId:id,reason:'测试排除'});const result=await rejected.json();assert.equal(result.matches.some(m=>m.item.id===id),false);assert.equal(result.matches.length,1);
    const boot=await s.bootstrap(),task=boot.tasks.find(t=>t.id===initial.taskId);assert.equal(task.excluded[0].item.id,id);assert.equal('privateNote' in task.excluded[0].item.body,false);
    const restored=await (await post(s,'feedback',{taskId:initial.taskId,itemId:id,restore:true})).json();assert.equal(restored.matches.length,2);assert.equal((await s.bootstrap()).tasks.find(t=>t.id===initial.taskId).excluded.length,0);
    const history=await (await handleApi(new Request('http://localhost/api/chat/history?taskId='+encodeURIComponent(initial.taskId)),s)).json();assert.equal(history.messages.at(-1).content,restored.message);assert.equal(history.messages.at(-1).matches.length,2);
  }finally{db.raw.close();}
});

test('已订阅任务收到拒绝跟进时真正取消，后到线索不再发通知',async()=>{
  const db=database(),s=service(db);try{
    const initial=await runChat(s,{text:'蓝色文件袋，持续留意'});assert.equal(initial.subscribed,true);
    const stopped=await runChat(s,{taskId:initial.taskId,text:'不用继续找了，不要订阅'});assert.equal(stopped.subscribed,false);assert.match(stopped.message,/已取消持续留意/);
    await service(db,'zhou').createItem({title:'合成文件袋',category:'包袋',color:'蓝色',location:'东中院',description:'用于取消订阅测试',custody:'本人'});assert.equal((await s.bootstrap()).notifications.length,0);
  }finally{db.raw.close();}
});
