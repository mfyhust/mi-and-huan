// All names, items and conversations are synthetic and maintained by this project.
// These labels test the executor; scripted model replies do not measure model quality.
import assert from 'node:assert/strict';

export const tool=(name,args={})=>({name,args});
const search=()=>tool('search_found_items',{category:'水杯',color:'黑色'});
const final={text:'请核对实际候选，最终归属需要保管人核实。'};
export const scenarios=[
  {id:'search-with-campus-tools',label:'读取任务、地点核对、查询真实合成候选',async run(c){
    const item=await c.item({location:'五餐二楼'});
    const r=await c.chat('五餐二楼丢了黑色保温杯',[[tool('get_search_task'),tool('resolve_campus_location',{query:'五餐二楼'}),search()],final]);
    assert.equal(r.mode,'model');assert.equal(r.matches[0].item.id,item.id);
    assert.deepEqual(r.criteria.locationInfo.places[0].floors,[2]);
  }},
  {id:'multi-turn-floor-correction',label:'连续对话更正楼层，候选排序同步',async run(c){
    await c.item({location:'五餐二楼'});const correct=await c.item({location:'五餐三楼'});
    await c.chat('五餐二楼丢了黑色保温杯',[[search()],final]);
    const r=await c.chat('不是二楼，是三楼',[[tool('update_search_criteria',{location:'五餐三楼'}),search()],final]);
    assert.deepEqual(r.criteria.locationInfo.places[0].floors,[3]);assert.equal(r.matches[0].item.id,correct.id);
  }},
  {id:'feedback-and-model-restore',label:'排除真实候选，模型读取上下文后按用户要求恢复',async run(c){
    const item=await c.item({location:'五餐二楼'});
    await c.chat('五餐丢了黑色保温杯',[[search()],final]);
    const rejected=await c.chat('这条不是我的，请排除',[[tool('record_rejection',{itemId:item.id,reason:'合成用户明确排除'})],final]);
    assert.equal(rejected.matches.some(m=>m.item.id===item.id),false);
    const restored=await c.chat('恢复刚才排除的那条',[[tool('get_search_task')],[tool('record_rejection',{itemId:item.id,reason:'用户确认误排除',restore:true})],final]);
    assert.equal(restored.matches[0].item.id,item.id);assert.equal(restored.toolExecutions[1].status,'completed');
  }},
  {id:'explicit-no-feedback',label:'用户明确说不要排除，模型发错指令也不能操作',async run(c){
    const item=await c.item({location:'五餐二楼'});await c.chat('黑色保温杯',[[search()],final]);
    const r=await c.chat('先不要排除这条，我还没确定',[[tool('record_rejection',{itemId:item.id,reason:'合成错误决策'})],final]);
    assert.equal(r.matches.length,1);assert.equal(r.toolExecutions[0].status,'rejected');assert.equal((await c.service.store.list('feedback')).length,0);
  }},
  {id:'ambiguous-feedback-clarification',label:'多条候选指代不清先追问，明确编号后再排除',async run(c){
    const first=await c.item({location:'五餐二楼'});await c.item({location:'五餐三楼'});
    await c.chat('五餐二楼丢了黑色保温杯',[[search()],final]);
    const ambiguous=await c.chat('这条不是我的',[[tool('record_rejection',{itemId:first.id,reason:'对象不明'}),tool('ask_clarifying_question',{question:'你想排除第几条候选？'})],final]);
    assert.equal(ambiguous.matches.length,2);assert.equal(ambiguous.toolExecutions[0].status,'rejected');assert.match(ambiguous.question,/第几条/);
    const r=await c.chat('第一条不是我的，请排除',[[tool('record_rejection',{itemId:first.id,reason:'用户确认第一条'})],final]);
    assert.equal(r.matches.length,1);assert.equal(r.matches.some(m=>m.item.id===first.id),false);
  }},
  {id:'subscribe-and-late-clue',label:'先无线索，订阅后新增物品产生站内提醒',async run(c){
    const r=await c.chat('五餐丢了黑色保温杯，请持续留意新线索',[[search(),tool('subscribe_to_clues')],final]);
    assert.equal(r.matches.length,0);assert.equal(r.subscribed,true);
    const item=await c.item({location:'五餐二楼'});
    assert.ok((await c.service.store.list('notification')).some(n=>n.owner==='lin'&&n.body.taskId===r.taskId&&n.body.itemId===item.id));
  }},
  {id:'one-clarifying-question',label:'同轮重复追问被拒绝，只保留一个问题',async run(c){
    const r=await c.chat('我丢了一只杯子',[[tool('ask_clarifying_question',{question:'杯子是什么颜色？'}),tool('ask_clarifying_question',{question:'是什么品牌？'})],final]);
    assert.equal(r.question,'杯子是什么颜色？');assert.deepEqual(r.toolExecutions.map(t=>t.status),['completed','rejected']);
  }},
  {id:'learn-only-after-confirmation',label:'模型仅提出地点草稿，用户确认后新会话可用',async run(c){
    const r=await c.chat('我在合成星禾自习室丢了黑杯，那里也叫合成星窝',[[tool('propose_place_learning',{name:'合成星禾自习室',aliases:'合成星窝'})],final]);
    assert.equal(r.learningProposal.status,'pending');
    assert.notEqual((await c.service.lookupPlace('合成星窝')).status,'resolved');
    await c.service.placeMemory.confirm(r.learningProposal.id);
    const lookup=await c.service.lookupPlace('合成星窝二楼');assert.equal(lookup.status,'resolved');
    c.newConversation();const followup=await c.chat('合成星窝二楼丢了黑杯',[[search()],final]);
    assert.equal(followup.criteria.locationInfo.places[0].name,'合成星禾自习室');
  }},
  {id:'recover-invalid-tool-without-authorization',label:'错误参数可纠正，未经许可不得订阅',async run(c){
    const r=await c.chat('丢了黑色保温杯，暂时不要订阅',[[tool('update_search_criteria',{color:{invalid:true}}),tool('subscribe_to_clues')],[search()],final]);
    assert.equal(r.mode,'model');assert.equal(r.subscribed,false);assert.equal(r.criteria.color,'黑色');
    assert.deepEqual(r.toolExecutions.map(t=>t.status),['rejected','rejected','completed']);
  }},
  {id:'unfinished-model-is-failure',label:'连续工具循环未完成，不得记成模型成功',async run(c){
    const r=await c.chat('找一只黑色保温杯',Array.from({length:6},()=>[tool('get_search_task')]));
    assert.equal(r.mode,'rules-fallback');assert.equal(r.modelErrorCode,'MODEL_ROUND_LIMIT');assert.equal(r.execution.modelRequests,6);
  }}
];
