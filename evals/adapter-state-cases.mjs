// Development scenarios, independent conversations; not a held-out quality benchmark.
import assert from 'node:assert/strict';
const completed=(r,name)=>r.toolExecutions.some(t=>t.tool===name&&t.status==='completed');
export const adapterStateCases=[
 {id:'search',async run(c){
  const item=await c.item();await c.item({category:'钥匙',title:'合成同色钥匙'});
  const r=await c.chat('请查询在五餐二楼遗失的黑色水杯，有没有拾获记录？');
  assert.ok(completed(r,'search_found_items'),'必须实际查询');
  assert.equal(r.criteria.category,'水杯');assert.equal(r.matches.length,1);assert.equal(r.matches[0].item.id,item.id);
 }},
 {id:'feedback-restore',async run(c){
  await c.item();await c.item({title:'另一只合成黑杯'});
  const first=await c.chat('我的黑色水杯落在五餐二楼，请查询。');
  assert.equal(first.matches.length,2);const id=first.matches[0].item.id;
  const rejected=await c.chat('请排除第一条候选，它不是我的。');
  assert.ok(completed(rejected,'get_search_task'),'反馈前应读取真实候选');
  assert.ok(completed(rejected,'record_rejection'));assert.equal(rejected.matches.some(m=>m.item.id===id),false);
  const restored=await c.chat('刚才误排除了，请恢复那一条。');
  assert.ok(completed(restored,'record_rejection'));assert.ok(restored.matches.some(m=>m.item.id===id));
 }},
 {id:'ambiguous-do-not-guess',async run(c){
  await c.item();await c.item({title:'另一只合成黑杯'});
  await c.chat('五餐二楼丢了黑色水杯，帮我找找拾获记录。');
  const r=await c.chat('这条不是我的。');
  assert.ok(completed(r,'ask_clarifying_question'),'对象不明确应主动追问');
  assert.equal((await c.s.store.list('feedback')).length,0,'不应凭猜测排除');
  assert.equal(r.matches.length,2);
 }},
 {id:'decline-no-write',async run(c){
  await c.item();await c.chat('五餐二楼的黑色水杯，查询一下。');
  const r=await c.chat('先不要排除，也不要订阅，我自己再核对一下。');
  assert.equal((await c.s.store.list('feedback')).length,0);assert.equal(r.subscribed,false);
  assert.equal(r.matches.length,1);assert.equal(completed(r,'record_rejection'),false);assert.equal(completed(r,'subscribe_to_clues'),false);
 }},
 {id:'category-preserved',async run(c){
  const card=await c.item({category:'其他',title:'合成绿色校园卡',color:'绿色'});
  await c.item({category:'文具',title:'合成绿色计算器',color:'绿色'});
  const r=await c.chat('五餐二楼遗失绿色校园卡，请搜索拾获记录。');
  assert.ok(completed(r,'search_found_items'));assert.equal(r.criteria.category,'其他');
  assert.equal(r.matches.length,1);assert.equal(r.matches[0].item.id,card.id);
 }},
 {id:'subscription-new-clue',async run(c){
  const r=await c.chat('五餐二楼丢了黑色水杯，请查询，没有结果的话订阅新线索。');
  assert.ok(completed(r,'search_found_items'));assert.ok(completed(r,'subscribe_to_clues'));assert.equal(r.subscribed,true);
  const item=await c.item();
  assert.ok((await c.s.store.list('notification')).some(n=>n.owner==='lin'&&n.body.taskId===r.taskId&&n.body.itemId===item.id));
 }},
];
