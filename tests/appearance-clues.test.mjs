import test from 'node:test';
import assert from 'node:assert/strict';
import {extract,rank} from '../lib/matching.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
const item=(id,color,description)=>({id,owner:'holder',body:{title:id,category:'水杯',color,description,status:'available',location:'第五餐饮大楼二楼'}});
test('主体颜色与杯盖、挂件等部件颜色分别保存，不再由最后一个颜色覆盖',()=>{
 const cases=[['黑色保温杯，白色杯盖','黑色','白色杯盖'],['黑色杯子，上面有红色挂件','黑色','红色挂件'],['白色杯盖，杯身是黑色','黑色','白色杯盖'],['黑色杯身，杯盖是白色','黑色','白色杯盖'],['白色耳机，黑色耳机盒','白色','黑色耳机盒'],['蓝色背包，红色背带','蓝色','红色背带']];
 for(const [text,color,feature] of cases){const c=extract(text);assert.equal(c.color,color,text);assert.ok(c.feature.includes(feature),text);}
});
test('只记得部件颜色时不猜主体；修改或遗忘部件不改变已确认主体颜色',()=>{
 let c=extract('杯子颜色记不清，只记得白色杯盖');assert.equal(c.color,'');assert.equal(c.clueHints.color.state,'unknown');assert.ok(c.feature.includes('白色杯盖'));
 c=extract('黑色水杯，白色杯盖');c=extract('杯盖不是白色，是红色杯盖',c);assert.equal(c.color,'黑色');assert.ok(c.feature.includes('红色杯盖'));assert.equal(c.feature.includes('白色杯盖'),false);
 c=extract('杯盖颜色记不清了',c);assert.equal(c.color,'黑色');assert.equal(c.feature.includes('红色杯盖'),false);assert.notEqual(c.clueHints.color?.state,'unknown');
 const part=extract('白色杯盖');assert.equal(part.color,'');assert.ok(part.feature.includes('白色杯盖'));assert.equal(part.category,undefined);const unknown=extract('物品类别记不清，白色杯盖');assert.equal(unknown.category,'');assert.equal(unknown.clueHints.category.state,'unknown');
});
test('部件作为软线索排序，缺少描述不硬排除，倒装描述与否定可区分',()=>{
 const c=extract('黑色水杯，白色杯盖');
 const matches=rank(c,[item('white-body','白色','白色杯子'),item('unknown-cap','黑色','一个黑色杯子'),item('white-cap','黑色','黑色杯身，杯盖是白色'),item('no-white-cap','黑色','黑色杯子，不是白色杯盖')]);
 assert.equal(matches[0].item.id,'white-cap');assert.equal(matches.some(m=>m.item.id==='white-body'),false);assert.equal(matches.some(m=>m.item.id==='unknown-cap'),true);assert.ok(matches.find(m=>m.item.id==='unknown-cap').pending.length);assert.ok(matches.find(m=>m.item.id==='no-white-cap').pending.length);
});
test('部件遗忘的持续语气不误清主体色，多个遗忘部件与主体更正分别保存',()=>{
 const prior=extract('黑色水杯，白色杯盖，红色挂件');
 for(const text of ['继续按现有线索查询，杯盖颜色仍然记不清','杯盖颜色还是不知道','杯盖的颜色我依然不记得','杯盖也忘了']){
  const c=extract(text,prior);assert.equal(c.color,'黑色',text);assert.deepEqual(c.appearanceUnknownParts,['杯盖']);assert.equal(c.feature.includes('白色杯盖'),false);assert.ok(c.feature.includes('红色挂件'));assert.notEqual(c.clueHints.color?.state,'unknown');
 }
 const both=extract('杯盖颜色还是不知道，挂件颜色也记不清了，但杯身是蓝色',prior);assert.equal(both.color,'蓝色');assert.deepEqual(both.appearanceUnknownParts,['杯盖','挂件']);
});
test('并列属性共享记不清时分别保存，不扩大为主体遗忘或改变地点原话',()=>{
 const prior=extract('黑色象印水杯，白色杯盖，红色挂件');
 for(const text of ['五餐二楼，品牌和杯盖颜色都记不清','杯盖颜色与品牌还是记不清','品牌、杯盖颜色及挂件颜色均不知道']){
  const c=extract(text,prior);assert.equal(c.color,'黑色');assert.equal(c.brand,'');assert.equal(c.clueHints.brand.state,'unknown');assert.ok(c.appearanceUnknownParts.includes('杯盖'));assert.equal(c.feature.includes('白色杯盖'),false);assert.notEqual(c.clueHints.color?.state,'unknown');
 }
 const own=extract('五餐二楼丢了黑色水杯，品牌和杯盖颜色都记不清，请查询');assert.equal(own.color,'黑色');assert.equal(own.clueHints.brand.state,'unknown');assert.deepEqual(own.appearanceUnknownParts,['杯盖']);assert.ok(own.location.includes('品牌和杯盖颜色都记不清'));
 const body=extract('主体颜色和品牌都记不清',prior);assert.equal(body.color,'');assert.equal(body.brand,'');assert.ok(body.feature.includes('白色杯盖'));
 const ordinary=extract('黑色水杯和白色杯盖，品牌记不清',{});assert.equal(ordinary.color,'黑色');assert.ok(ordinary.feature.includes('白色杯盖'));
 const negated=extract('不是说品牌和杯盖颜色都记不清',prior);assert.equal(negated.brand,'象印');assert.ok(negated.feature.includes('白色杯盖'));assert.deepEqual(negated.appearanceUnknownParts,prior.appearanceUnknownParts);
});
test('可能的部件外观仍提示不确定，不扩大为主体颜色的可能范围',()=>{
 const c=extract('黑色水杯，可能是白色杯盖');assert.equal(c.color,'黑色');assert.equal(c.clueHints.color,undefined);assert.ok(c.feature.includes('可能：白色杯盖'));
 const m=rank(c,[item('cap','黑色','黑色杯子白色杯盖')])[0];assert.ok(m.pending.some(p=>p.includes('尚未确定')));
});
test('Agent多轮检索保留部件与主体角色，模型误传杯盖颜色不会覆写主体',async()=>{
 const db=database(),s=service(db),h=service(db,'zhou'),old=globalThis.fetch;
 try{
  for(const [title,color,description] of [['黑身白盖','黑色','黑色杯身，白色杯盖'],['白身黑盖','白色','白色杯身，黑色杯盖']])await h.createItem({title,category:'水杯',color,description,location:'五餐二楼',custody:'合成保管处'});
  let turn=0;globalThis.fetch=async()=>Response.json({choices:[{message:++turn%2?{role:'assistant',content:null,tool_calls:[{id:'synthetic',type:'function',function:{name:'search_found_items',arguments:JSON.stringify({category:'水杯',color:'白色'})}}]}:{role:'assistant',content:'请核对公开特征。'}}]});
  const r=await runChat(s,{text:'五餐二楼丢了黑色杯子，白色杯盖',llm:{provider:'deepseek',key:'synthetic-only',model:'test'}});assert.equal(r.mode,'model');assert.equal(r.criteria.color,'黑色');assert.equal(r.matches[0].item.body.title,'黑身白盖');assert.equal(r.matches.some(m=>m.item.body.color==='白色'),false);
 }finally{globalThis.fetch=old;db.close?.();db.raw.close();}
});

test('相邻省略更正继承部件，不把新部件颜色改为主体颜色',()=>{
 for(const text of ['杯盖不是白色，是红色','杯盖颜色并非白色，应该是红色','白色杯盖，不对，是红色']){
  const c=extract(text,extract('黑色水杯，白色杯盖'));assert.equal(c.color,'黑色',text);assert.ok(c.feature.includes('红色杯盖'),text);assert.equal(c.feature.includes('白色杯盖'),false,text);
  const hits=rank(c,[item('white-cap','黑色','白色杯盖'),item('red-cap','黑色','红色杯盖')]);assert.equal(hits[0].item.id,'red-cap');assert.equal(hits.length,2);
 }
 const uncertain=extract('杯盖不是白色，可能是红色',extract('黑色水杯，白色杯盖'));assert.equal(uncertain.color,'黑色');assert.ok(uncertain.feature.includes('可能：红色杯盖'));
});
test('省略更正不跨越显式新主体，也不从无依据的孤立颜色猜部件',()=>{
 const prior=extract('黑色水杯，白色杯盖');
 const body=extract('杯盖不是白色，是红色杯身',prior);assert.equal(body.color,'红色');assert.equal(body.feature.includes('红色杯盖'),false);
 const separate=extract('杯盖不是白色。红色水杯',prior);assert.equal(separate.color,'红色');assert.equal(separate.feature.includes('红色杯盖'),false);
 const plain=extract('红色',prior);assert.equal(plain.color,'红色');assert.ok(plain.feature.includes('白色杯盖'));
});
