import assert from 'node:assert/strict';
const completed=r=>r.toolExecutions.some(t=>t.tool==='search_found_items'&&t.status==='completed');
export const releaseCases=[
 {id:'uncertainty-confirm-forget',async run(c){
  await c.item({title:'合成黑杯',color:'黑色',location:'五餐二楼'});const blue=await c.item({title:'合成蓝杯',color:'蓝色',location:'五餐二楼'});
  const a=await c.chat('五餐二楼丢了水杯，可能黑色或蓝色，品牌不记得，请查询');assert.ok(completed(a));assert.equal(a.matches.length,2);assert.equal(a.criteria.clueHints.color.state,'tentative');
  const b=await c.chat('现在确认是蓝色，请重新查询');assert.ok(completed(b));assert.equal(b.matches.length,1);assert.equal(b.matches[0].item.id,blue.id);
  const d=await c.chat('刚才记错了，颜色不记得了，请保留其余条件重新查询');assert.ok(completed(d));assert.equal(d.matches.length,2);assert.equal(d.criteria.clueHints.color.state,'unknown');c.fact('confirmationAndForgettingPreserved',true);
 }},
 {id:'time-window-correction',async run(c){
  const inside=await c.item({date:'2026-10-21',location:'五餐二楼'});await c.item({date:'2026-10-19',location:'五餐二楼'});
  const a=await c.chat('五餐二楼丢了黑色水杯，日期在2026-10-20到2026-10-22之间，请查询');assert.ok(completed(a));assert.deepEqual(a.criteria.dateRange,{start:'2026-10-20',end:'2026-10-22'});assert.equal(a.matches[0].item.id,inside.id);
  const b=await c.chat('确认遗失日期是2026-10-21，请重新查询');assert.ok(completed(b));assert.equal(b.criteria.dateRange,null);assert.equal(b.criteria.date,'2026-10-21');c.fact('rangeNotCollapsedByModel',true);
 }},
 {id:'empty-diagnosis-explicit-correction',async run(c){
  const blue=await c.item({title:'合成蓝色象印杯',color:'蓝色',brand:'象印',location:'五餐二楼'});
  const a=await c.chat('五餐二楼丢了黑色象印水杯，请查找');assert.ok(completed(a));assert.equal(a.matches.length,0);assert.equal(a.criteria.color,'黑色');assert.equal(a.searchDiagnostics.status,'criteria_blocked');
  const b=await c.chat('颜色记不清了，请保留品牌和地点重新查询');assert.ok(completed(b));assert.equal(b.matches[0].item.id,blue.id);assert.equal(b.criteria.brand,'象印');assert.equal(b.criteria.clueHints.color.state,'unknown');c.fact('noAutomaticRelaxation',true);
 }}
];
