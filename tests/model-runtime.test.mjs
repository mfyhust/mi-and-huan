import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveModelConfig,modelInfo,completeModel} from '../lib/model-runtime.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';

const local={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'qwen3:8b',LLM_PROVIDER:'sjtu',LLM_API_KEY:'must-never-leave'};
test('离线版忽略旧API私密配置，固定本机模型目的地，不要求外网密钥',()=>{
  const config=resolveModelConfig(local);
  assert.equal(config.url,'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(config.model,'qwen3:8b');assert.equal(config.key,'');
  const info=modelInfo(local);assert.equal(info.configured,true);assert.deepEqual(info.providers,['ollama']);
  assert.equal(JSON.stringify(info).includes('must-never-leave'),false);
});
test('离线版拒绝浏览器更换供应商、密钥、模型、外部地址和云模型',()=>{
  for(const input of [{provider:'sjtu'},{provider:'deepseek'},{key:'browser-secret'},{model:'qwen3:8b-cloud'},{model:'different-local-model'},{base_url:'https://example.com'},{url:'https://example.com'}])assert.throws(()=>resolveModelConfig(local,input),{status:400});
  for(const name of ['qwen3:8b-cloud','https://example.com/model','x/y','x\nAuthorization: other'])assert.throws(()=>resolveModelConfig({...local,LOCAL_MODEL_NAME:name}),{status:400});
  assert.throws(()=>resolveModelConfig({XUNHUI_EDITION:'typo'}),{status:400});
});
test('离线版拒绝请求发生在任务创建和网络访问之前',async()=>{
  const db=database(),s=service(db,'lin','test:local',local),original=globalThis.fetch;
  let requests=0;globalThis.fetch=async()=>{requests++;throw new Error('must not fetch');};
  try{
    await assert.rejects(()=>runChat(s,{text:'找杯子',llm:{provider:'sjtu',key:'forbidden'}}),{status:400});
    assert.equal(requests,0);assert.equal((await s.store.list('task')).length,0);
  }finally{globalThis.fetch=original;db.raw.close();}
});
test('离线推理失败只降级为本地规则，不请求API，不转发旧密钥',async()=>{
  const db=database(),s=service(db,'lin','demo:offline',local),original=globalThis.fetch;
  const urls=[];globalThis.fetch=async(url,options)=>{urls.push(url);assert.equal(options.headers.authorization,undefined);throw new Error('local inference unavailable');};
  try{
    await s.seed();const result=await runChat(s,{text:'黑色保温杯'});
    assert.equal(result.mode,'rules-fallback');assert.equal(result.matches.length,2);
    assert.equal(result.edition,'local');assert.deepEqual(urls,['http://127.0.0.1:11434/v1/chat/completions']);
    assert.equal(result.execution.modelRequests,1);
  }finally{globalThis.fetch=original;db.raw.close();}
});
test('拒绝模型服务外部重定向，不跟随Location',async()=>{
  const original=globalThis.fetch;let requests=0;
  globalThis.fetch=async(url,options)=>{requests++;assert.equal(options.redirect,'manual');return new Response(null,{status:307,headers:{location:'https://example.com'}});};
  try{await assert.rejects(()=>completeModel(resolveModelConfig(local),[]),/重定向/);assert.equal(requests,1);}
  finally{globalThis.fetch=original;}
});
test('API版固定供应商地址并保持服务端密钥配套，本地端点必须用独立入口',()=>{
  const config=resolveModelConfig({LLM_PROVIDER:'sjtu',LLM_MODEL:'deepseek-chat',LLM_API_KEY:'test-key'},{provider:'qwen',model:'qwen-plus',key:''});
  assert.equal(config.provider,'sjtu');assert.equal(config.key,'test-key');
  assert.throws(()=>resolveModelConfig({}, {provider:'ollama'}),{status:400});
});
test('严格轮次截止时间用作请求超时，过期后不再调用模型',async()=>{
  const original=globalThis.fetch;let requests=0;
  globalThis.fetch=async(url,options)=>{requests++;assert.ok(options.signal);return Response.json({choices:[{message:{role:'assistant',content:'继续核对'}}]});};
  try{await assert.rejects(()=>completeModel(resolveModelConfig(local),[],undefined,Date.now()-1),/时间限制/);assert.equal(requests,0);}
  finally{globalThis.fetch=original;}
});
test('模型参数错误反馈给模型修正，不把对象或未知字段写入任务；用量与请求数分开记录',async()=>{
  const db=database(),s=service(db,'lin','demo:local-tools',local),original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async(url,options)=>{
    const payload=JSON.parse(options.body);requests++;
    if(requests===2)assert.match(payload.messages.at(-1).content,/不正确/);
    const message=requests===1?{role:'assistant',content:null,tool_calls:[{id:'bad',type:'function',function:{name:'update_search_criteria',arguments:'{"color":{"value":"黑色"}}'}}]}:{role:'assistant',content:'请继续核对。'};
    return Response.json({choices:[{message}],usage:{prompt_tokens:10,completion_tokens:5}});
  };
  try{
    await s.seed();const result=await runChat(s,{text:'保温杯'});
    assert.equal(result.mode,'model');assert.equal(result.criteria.color,undefined);
    assert.deepEqual(result.execution,{modelRequests:2,toolCalls:1,usageReportedRequests:2,inputTokens:20,outputTokens:10});
  }finally{globalThis.fetch=original;db.raw.close();}
});
test('重复工具调用达到总预算会停止，不能无限循环；未知用量保持null',async()=>{
  const db=database(),s=service(db,'lin','demo:budget',local),original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:Array.from({length:7},(_,n)=>({id:'call-'+requests+'-'+n,type:'function',function:{name:'get_search_task',arguments:'{}'}}))}}]});
  const mock=globalThis.fetch;globalThis.fetch=(...args)=>{requests++;return mock(...args);};
  try{
    const result=await runChat(s,{text:'保温杯'});
    assert.equal(result.mode,'rules-fallback');assert.match(result.modelError,/限制/);
    assert.equal(requests,2);assert.equal(result.execution.toolCalls,7);
    assert.equal(result.execution.inputTokens,null);assert.equal(result.execution.outputTokens,null);
  }finally{globalThis.fetch=original;db.raw.close();}
});
