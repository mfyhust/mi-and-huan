import test from 'node:test';import assert from 'node:assert/strict';
import {nextQuestion,extract,rank} from '../lib/matching.mjs';
import {criteriaFrom} from '../lib/service.mjs';
import {requestsItemSearch,runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
const row=(id,description,color='黑色')=>({item:{id,owner:'holder',body:{category:'水杯',color,brand:'象印',description,status:'available'}}});
const candidates=[row('one','黑色杯身，白色杯盖'),row('two','黑色杯身，杯盖是红色')];
test('主体和品牌相同时按公开部件差异追问，答案不把杯盖颜色变为主体条件',()=>{
 const c={category:'水杯',color:'黑色',brand:'象印'},q=nextQuestion(c,candidates);
 assert.equal(q.field,'partColor:杯盖');assert.equal(q.knownCandidates,2);assert.equal(q.answerOptions.length,3);
 const answer=extract(q.answerOptions.find(o=>o.label==='白色').prompt,c);
 assert.equal(answer.color,'黑色');assert.ok(answer.feature.includes('白色杯盖'));assert.equal(nextQuestion(answer,candidates),null);
});
test('部件遗忘单独持久化，后续不会反复问；明确新线索可重新启用',()=>{
 const c=extract('杯盖颜色记不清了',{category:'水杯',color:'黑色',brand:'象印'});
 assert.deepEqual(c.appearanceUnknownParts,['杯盖']);assert.equal(nextQuestion(c,candidates),null);
 assert.deepEqual(criteriaFrom(c).appearanceUnknownParts,['杯盖']);assert.equal(nextQuestion(extract('请重新查询',c),candidates),null);
 const restored=extract('杯盖可能是白色',c);assert.deepEqual(restored.appearanceUnknownParts,[]);assert.equal(nextQuestion(restored,candidates).field,'partColor:杯盖');
 const allUnknown=extract('外观特征记不清了',{category:'水杯',color:'黑色',brand:'象印'});assert.equal(nextQuestion(allUnknown,candidates),null);
 assert.deepEqual(criteriaFrom({appearanceUnknownParts:['盖子','杯盖','秘密号码','杯盖',null]}).appearanceUnknownParts,['杯盖']);
});
test('不把否定、可能、矛盾或缺失的候选描述当作可确认的部件差异',()=>{
 for(const description of ['不是红色杯盖','可能红色杯盖','白色杯盖、红色杯盖','未登记杯盖'])assert.equal(nextQuestion({category:'水杯',color:'黑色',brand:'象印'},[candidates[0],row('bad',description)]),null,description);
});
test('相同主体颜色的深浅别名不制造虚假追问，部件仍可区分',()=>{
 const q=nextQuestion({category:'水杯'},[row('one','白色杯盖','深绿色'),row('two','红色杯盖','绿色')]);
 assert.equal(q.field,'partColor:杯盖');assert.equal(q.text.includes('深绿色、绿色'),false);
});
test('确认部件后相符候选优先但不同或未登记候选仍保留待核实',()=>{
 const c=extract('杯盖是红色',{category:'水杯',color:'黑色',brand:'象印'});
 const result=rank(c,[...candidates,row('missing','未登记杯盖')].map(m=>m.item));
 assert.equal(result[0].item.id,'two');assert.equal(result.length,3);
 assert.ok(result.find(m=>m.item.id==='one').pending.some(p=>p.includes('外观待核实')));
 assert.equal(result[0].reasons.some(r=>r.includes('红色杯盖')),true);
});
test('查询执行核对区分明确请求、操作提问、拒绝和图片中文字',()=>{
 for(const text of ['请重新查询已有拾获记录','帮我查一下','暂不搜索，先重新查询已有记录'])assert.equal(requestsItemSearch(text),true,text);
 for(const text of ['暂时不要继续查询','先不查询了','请停止搜索','如何查询失物','能不能查询','照片上写着请查询','如果重新查询会怎样','不用帮我查一下'])assert.equal(requestsItemSearch(text),false,text);
});
for(const edition of ['local','api'])test(edition+' 两轮Agent保留公开差异建议与部件遗忘，模拟模型不能改写主体',async()=>{
 const db=database(),old=globalThis.fetch;let n=0;
 const transport=async()=>Response.json({choices:[{message:++n%2?{role:'assistant',content:null,tool_calls:[{id:'fixture-'+n,type:'function',function:{name:'search_found_items',arguments:'{"category":"水杯","color":"黑色"}'}}]}:{role:'assistant',content:n===4?'请确认白色杯盖，白色条件仍保留。':'请核对公开线索。'}}]});
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic'};
 const s=service(db,'lin','demo:parts',env),h=service(db,'zhou','demo:parts',env);globalThis.fetch=transport;
 try{
  for(const c of candidates)await h.createItem({title:c.item.id+'合成杯',category:'水杯',color:'黑色',brand:'象印',description:c.item.body.description,location:'五餐二楼',custody:'合成保管者'});
  const first=await runChat(s,{text:'五餐二楼丢了黑色象印水杯，请查询'});assert.equal(first.mode,'model');assert.equal(first.clarification.field,'partColor:杯盖');
  const second=await runChat(s,{taskId:first.taskId,text:'杯盖颜色记不清了'});assert.equal(second.mode,'model');assert.equal(second.clarification,null);assert.equal(second.criteria.color,'黑色');assert.equal(second.matches.length,2);assert.equal(second.replyAdjusted,true);assert.equal(second.message.includes('白色杯盖'),false);assert.ok(second.message.includes('主体颜色仍保留为黑色'));assert.ok(second.message.includes('记不清，暂不限定'));
  const task=await s.task(first.taskId);assert.deepEqual(task.body.criteria.appearanceUnknownParts,['杯盖']);
  const third=await runChat(s,{taskId:first.taskId,text:'杯盖是白色'});assert.equal(third.criteria.color,'黑色');assert.ok(third.criteria.feature.includes('白色杯盖'));assert.equal(third.clarification,null);assert.equal(third.matches[0].item.body.title,'one合成杯');assert.deepEqual(third.criteria.appearanceUnknownParts,[]);
  const corrected=await runChat(s,{taskId:first.taskId,text:'杯盖不是白色，是红色'});assert.equal(corrected.criteria.color,'黑色');assert.ok(corrected.criteria.feature.includes('红色杯盖'));assert.equal(corrected.criteria.feature.includes('白色杯盖'),false);assert.equal(corrected.matches[0].item.body.title,'two合成杯');
  const messages=await s.store.list('message');assert.equal(messages.find(m=>m.body.role==='assistant'&&m.body.clarification).body.clarification.field,'partColor:杯盖');
 }finally{globalThis.fetch=old;db.raw.close();}
});
