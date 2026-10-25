import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLocalModel,evaluationPlan,parseEvaluationArgs,MODEL} from '../evals/run-local-model.mjs';
import {localMetadata} from '../offline/model-inventory.mjs';

test('实际模型评测默认只输出计划，未知参数和外部元数据路径拒绝执行',()=>{
  const options=parseEvaluationArgs([]),plan=evaluationPlan(options.suite);assert.equal(options.run,false);assert.equal(plan.runsModel,false);assert.equal(plan.maxRequests,4);assert.equal(plan.model,MODEL);assert.equal(evaluationPlan('journey').maxRequests,32);
  assert.throws(()=>evaluationPlan('unknown'));
  assert.throws(()=>localMetadata('https://example.com/api/tags'),/固定/);
  assert.throws(()=>parseEvaluationArgs(['--url','https://example.com']));
  assert.throws(()=>parseEvaluationArgs(['--suite','unknown']));assert.equal(parseEvaluationArgs(['--run']).run,true);
});

test('实际评测入口可用模拟传输验收，但报告明确标记模拟且不泄露私密特征',async()=>{
  let calls=0;
  const report=await evaluateLocalModel({transport:async(url,options)=>{
    calls++;assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');assert.equal(options.headers.authorization,undefined);
    const input=JSON.parse(options.body);assert.equal(input.reasoning_effort,'none');assert.equal(input.model,MODEL);assert.equal(options.body.includes('合成非公开标记'),false);
    const message=calls===1?{role:'assistant',content:null,tool_calls:[{id:'search',type:'function',function:{name:'search_found_items',arguments:'{"category":"水杯","color":"黑色","location":"五餐二楼"}'}}]}:{role:'assistant',content:'有一条候选，请人工核实。'};
    return Response.json({choices:[{message}]});
  }});
  assert.equal(report.fixtureOnly,true);assert.equal(report.summary.passed,1);assert.equal(report.requests,2);assert.equal(report.disconnectedAccepted,false);
});

test('只有模型纯文本、自动刷新出候选时不能作为真实工具调用通过',async()=>{
  const report=await evaluateLocalModel({transport:async()=>Response.json({choices:[{message:{role:'assistant',content:'找到一个候选。'}}]})});
  assert.equal(report.summary.failed,1);assert.match(report.cases[0].error,/搜索工具/);assert.equal(report.requests,2);
  assert.equal(report.cases[0].turns[0].mode,'rules-fallback');
  assert.equal(report.cases[0].turns[0].errorCode,'MODEL_INCOMPLETE_ACTION');
});

test('真实评测入口的总请求预算有效，工具循环失败不计为通过',async()=>{
  let calls=0;
  const report=await evaluateLocalModel({transport:async()=>Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'loop-'+(++calls),type:'function',function:{name:'get_search_task',arguments:'{}'}}]}}]})});
  assert.equal(calls,4);assert.equal(report.requests,4);assert.equal(report.summary.failed,1);
  assert.equal(report.cases[0].turns[0].mode,'rules-fallback');
});

test('交付场景评测有独立预算且默认不执行真实推理',()=>{const plan=evaluationPlan('release');assert.equal(plan.maxRequests,24);assert.equal(plan.maxWallMs,600000);assert.equal(plan.runsModel,false);assert.equal(parseEvaluationArgs(['--suite','release']).run,false);});
