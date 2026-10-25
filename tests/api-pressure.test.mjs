import test from 'node:test';import assert from 'node:assert/strict';
import {createApiPressureGuard,retryDelay} from '../lib/api-pressure.mjs';
import {resolveModelConfig,completeModel} from '../lib/model-runtime.mjs';
test('API退避尊重秒数和日期，异常及过大等待有界，不安排自动重试',()=>{
 assert.equal(retryDelay('7',429,0),7000);assert.equal(retryDelay('99999',429,0),60000);assert.equal(retryDelay('invalid',429,0),15000);assert.equal(retryDelay('Thu, 01 Jan 1970 00:00:10 GMT',503,0),10000);
});
test('同一凭据并发受限，模型切换不绕过；不同凭据隔离，释放和冷却到期可恢复',()=>{
 let now=0;const acquire=createApiPressureGuard(()=>now),transport=()=>{},config={provider:'sjtu',key:'synthetic-a'};
 const slot=acquire(config,transport);assert.throws(()=>acquire({...config,model:'another'},transport),{code:'MODEL_BUSY'});
 const other=acquire({...config,key:'synthetic-b'},transport);other.release();slot.failed({code:'MODEL_RATE_LIMIT',retryAfterMs:9000});slot.release();
 assert.throws(()=>acquire(config,transport),e=>e.code==='MODEL_COOLDOWN'&&e.retryAfterMs===9000);now=9001;acquire(config,transport).release();
});
test('真实适配层限流后不再次联网，保留错误且无自动切模型，本机不受API冷却影响',async()=>{
 const old=globalThis.fetch;let n=0;globalThis.fetch=async()=>{n++;return new Response('',{status:429,headers:{'retry-after':'10'}});};
 const config=resolveModelConfig({XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic-rate-key'});
 try{
  await assert.rejects(()=>completeModel(config,[]),e=>e.code==='MODEL_RATE_LIMIT'&&e.retryAfterMs===10000);
  await assert.rejects(()=>completeModel({...config,model:'another'},[]),{code:'MODEL_COOLDOWN'});assert.equal(n,1);
  const local=resolveModelConfig({XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:async()=>Response.json({choices:[{message:{role:'assistant',content:'local fixture'}}]})});
  assert.equal((await completeModel(local,[])).message.content,'local fixture');assert.equal(n,1);
 }finally{globalThis.fetch=old;}
});
