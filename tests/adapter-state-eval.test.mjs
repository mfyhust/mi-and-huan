import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,runStateCases,EvaluationStore} from '../evals/run-adapter-agent.mjs';
import {openDatabase} from '../offline/storage.mjs';
import {adapterStateCases} from '../evals/adapter-state-cases.mjs';

test('adapter evaluation defaults to no model and rejects invalid budget',()=>{
 assert.equal(parseArgs([]).run,false);
 assert.throws(()=>parseArgs(['--run']));
 assert.throws(()=>parseArgs(['--max-seconds','99999']));
 assert.throws(()=>parseArgs(['--provider','cloud']));
 assert.equal(parseArgs(['--suite','focus','--case','category-preserved']).caseId,'category-preserved');
 assert.throws(()=>parseArgs(['--suite','focus','--case','unknown']));
});

test('paired eval identities are opaque and unrelated to variant or scenario',()=>{
 const a=openDatabase(':memory:'),b=openDatabase(':memory:');
 try{
  const left=new EvaluationStore(a),right=new EvaluationStore(b);
  const item=left.record('item','zhou',{});right.record('audit','lin',{});
  assert.deepEqual(item,right.record('item','zhou',{}));
  assert.notEqual(item.id,left.record('task','lin',{}).id);
  assert.equal(item.id.includes('item'),false);assert.equal(item.id.includes('base'),false);
 }finally{a.close();b.close();}
});

test('real executor state suite refuses text-only false search success',async()=>{
 const cases=await runStateCases({definitions:adapterStateCases.slice(0,1),variant:'fixture',deadline:Date.now()+10000,
  transport:async()=>Response.json({choices:[{message:{role:'assistant',content:'已经搜索到匹配物品。'}}]})});
 assert.equal(cases[0].passed,false);
 assert.match(cases[0].error,/实际查询/);
 assert.equal(cases[0].turns[0].mode,'rules-fallback');
 assert.equal(cases[0].turns[0].errorCode,'MODEL_INCOMPLETE_ACTION');
});

test('synthetic protocol fixture reaches actual search state without real model',async()=>{
 let count=0;
 const cases=await runStateCases({definitions:adapterStateCases.slice(0,1),variant:'fixture',deadline:Date.now()+10000,
  transport:async(url,options)=>{
   const payload=JSON.parse(options.body);
   assert.ok(payload.messages[0].content.includes('校园失物找回Agent'));
   assert.equal(payload.messages.some(m=>String(m.content).includes('不可向模型公开的合成标记')),false);
   const message=++count===1?{role:'assistant',content:null,tool_calls:[{id:'fixture-search',type:'function',function:{name:'search_found_items',arguments:JSON.stringify({category:'水杯',color:'黑色',location:'五餐二楼'})}}]}:{role:'assistant',content:'有一条候选，请联系保管人核实。'};
   return Response.json({choices:[{message}]});
  }});
 assert.equal(cases[0].passed,true);assert.equal(count,2);
});
