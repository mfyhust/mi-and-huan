import test from 'node:test';import assert from 'node:assert/strict';import {evaluateApiJourney} from '../evals/run-api-journey.mjs';
test('API整体验收不把文本假查询记成功，模拟传输标注且预算有界',async()=>{
 const r=await evaluateApiJourney({config:{provider:'sjtu',model:'fixture',key:'synthetic-credential'},suite:'smoke',transport:async()=>Response.json({choices:[{message:{role:'assistant',content:'已经查询。'}}]})});
 assert.equal(r.fixtureOnly,true);assert.equal(r.summary.failed,1);assert.equal(r.requests,2);assert.equal(r.cases[0].turns[0].errorCode,'MODEL_INCOMPLETE_ACTION');assert.equal(JSON.stringify(r).includes('synthetic-credential'),false);
});
