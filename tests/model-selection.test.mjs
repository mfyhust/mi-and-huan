import test from 'node:test';
import assert from 'node:assert/strict';
import {modelSelection} from '../lib/model-selection.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
test('本机界面选择规则时请求与标识一致，旧API选择不向本机转发',()=>{
  const info={edition:'local',model:'local-model'};
  const rules=modelSelection(info,{source:'rules'});assert.deepEqual(rules.request,{source:'rules'});assert.equal(rules.enabled,false);
  const local=modelSelection(info,{source:'session',provider:'sjtu',key:'synthetic-key',model:'remote-model'});
  assert.deepEqual(local.request,{});assert.equal(local.model,'local-model');assert.equal(local.enabled,true);
});
test('API界面保持配套配置，规则选择不发起任何模型请求',async()=>{
  assert.deepEqual(modelSelection({edition:'api',configured:true},{source:'server'}).request,{source:'server'});
  for(const edition of ['local','api']){
    const db=database(),saved=globalThis.fetch;let calls=0;
    globalThis.fetch=async()=>{calls++;throw new Error('不应请求模型');};
    const s=service(db,'lin','demo:selection',{XUNHUI_EDITION:edition,LOCAL_MODEL_NAME:'fixture-only',LLM_API_KEY:'synthetic-key',LLM_PROVIDER:'sjtu',LOCAL_MODEL_FETCH:async()=>{calls++;throw new Error('不应请求模型');}});
    try{const r=await runChat(s,{text:'五餐二楼丢了黑色保温杯',llm:modelSelection({edition},{source:'rules'}).request});assert.equal(r.mode,'rules');assert.equal(r.execution.modelRequests,0);assert.equal(calls,0);}
    finally{globalThis.fetch=saved;db.raw.close();}
  }
});
