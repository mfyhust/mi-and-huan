import test from 'node:test';import assert from 'node:assert/strict';
import {checkClarification,checkReplyClarifications} from '../lib/question-policy.mjs';import {runChat} from '../lib/agent.mjs';import {database,service} from './helpers.mjs';
test('明确属性追问区分已知、记不清、可能范围和其他有用细节',()=>{
 assert.equal(checkClarification('杯子是什么颜色？',{color:'黑色',clueHints:{}}).code,'QUESTION_KNOWN');
 assert.equal(checkClarification('是什么牌子？',{clueHints:{brand:{state:'unknown'}}}).code,'QUESTION_FORGOTTEN');
 assert.equal(checkClarification('你能确认颜色吗？',{color:'黑色',clueHints:{color:{state:'tentative',options:['黑色','蓝色']}}}).allowed,true);
 assert.equal(checkClarification('杯盖是什么颜色？',{color:'黑色',feature:'白色杯盖'}).code,'QUESTION_KNOWN');
 assert.equal(checkClarification('杯盖是什么颜色？',{appearanceUnknownParts:['杯盖']}).code,'QUESTION_FORGOTTEN');
 assert.equal(checkClarification('杯盖有没有图案？',{appearanceUnknownParts:['杯盖']}).allowed,true);
 assert.equal(checkClarification('具体是哪天？',{date:'2026-10-21'}).code,'QUESTION_KNOWN');
 assert.equal(checkClarification('具体是哪天？',{dateRange:{start:'2026-10-20',end:'2026-10-22'}}).code,'QUESTION_KNOWN');
 assert.equal(checkClarification('是什么颜色？',{color:'黑色',clueHints:{color:{state:'excluded',options:['白色']}}}).code,'QUESTION_KNOWN');
 assert.equal(checkClarification('品牌和颜色是什么？',{}).code,'QUESTION_MULTIPLE_FIELDS');
 assert.equal(checkReplyClarifications('已保留你记不清品牌的说明。',{clueHints:{brand:{state:'unknown'}}}).allowed,true);
 assert.equal(checkReplyClarifications('你能确认是什么颜色吗？',{clueHints:{color:{state:'tentative',options:['黑色','蓝色']}}}).allowed,true);
 assert.equal(checkReplyClarifications('物品是什么颜色？',{color:'黑色'}).code,'QUESTION_KNOWN');
 assert.equal(checkReplyClarifications('杯盖有没有图案？',{appearanceUnknownParts:['杯盖']}).allowed,true);
});
for(const edition of ['local','api'])test(edition+' 模型重复追问被拒绝后可改问另一未知属性，不改条件或伪称成功',async()=>{
 const db=database(),old=globalThis.fetch;let n=0;
 const transport=async()=>{const question=++n===1?'是什么品牌？':'是什么颜色？';return Response.json({choices:[{message:n<3?{role:'assistant',content:null,tool_calls:[{id:'q-'+n,type:'function',function:{name:'ask_clarifying_question',arguments:JSON.stringify({question})}}]}:{role:'assistant',content:'请再告诉我是什么品牌。'}}]});};
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic'};globalThis.fetch=transport;
 const s=service(db,'lin','demo:question-guard',env);
 try{
  const r=await runChat(s,{text:'我丢了水杯，品牌记不清'});assert.equal(r.mode,'model');assert.equal(r.toolExecutions[0].status,'rejected');assert.equal(r.toolExecutions[1].status,'completed');assert.equal(r.question,'是什么颜色？');assert.equal(r.message.includes('再告诉我是什么品牌'),false);assert.equal(r.replyAdjusted,true);assert.equal(r.criteria.clueHints.brand.state,'unknown');assert.equal(n,3);
  assert.ok(r.traces.some(t=>t.name==='避免重复或无效追问'));
 }finally{globalThis.fetch=old;db.raw.close();}
});
for(const edition of ['local','api'])test(edition+' 最终文字不能绕过追问校验，保留有用的候选核对建议',async()=>{
 const db=database(),old=globalThis.fetch;let reply='品牌是什么？请再告诉我品牌。';
 const transport=async()=>Response.json({choices:[{message:{role:'assistant',content:reply}}]});
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic'};globalThis.fetch=transport;
 const s=service(db,'lin','demo:question-final-guard',env);
 try{
  const r=await runChat(s,{text:'我丢了水杯，品牌记不清'});assert.equal(r.mode,'model');assert.equal(r.message.includes('品牌是什么'),false);assert.equal(r.replyAdjusted,true);assert.equal(r.criteria.clueHints.brand.state,'unknown');assert.equal(r.toolExecutions.length,0);
  reply='请核对候选记录中的品牌是否一致，再向保管人提交核实申请。';
  const useful=await runChat(s,{text:'继续保留现有条件',taskId:r.taskId});assert.equal(useful.message,reply);assert.equal(useful.replyAdjusted,false);
 }finally{globalThis.fetch=old;db.raw.close();}
});
