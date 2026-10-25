import test from 'node:test';
import assert from 'node:assert/strict';
import {extract,rank,nextQuestion,clueLabel,sanitizeClueHints} from '../lib/matching.mjs';
import {criteriaFrom,handleApi} from '../lib/service.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
const item=(id,body={})=>({id,owner:'holder',body:{category:'水杯',color:'黑色',brand:'象印',location:'五餐二楼',description:'带吸管和贴纸',status:'available',...body}});

test('可能颜色保留多个范围，忘记品牌不改变确定的类别',()=>{
 const c=extract('五餐二楼丢了保温杯，可能黑色或蓝色，品牌不记得，带吸管和贴纸');
 assert.deepEqual(c.clueHints.color,{state:'tentative',options:['黑色','蓝色']});
 assert.deepEqual(c.clueHints.brand,{state:'unknown',options:[]});assert.equal(c.category,'水杯');
 assert.equal(c.feature,'吸管、贴纸');assert.equal(clueLabel(c,'color'),'可能：黑色或蓝色');
 assert.equal(clueLabel(c,'brand'),'记不清，暂不限定');
 const hits=rank(c,[item('black'),item('blue',{color:'蓝色'}),item('book',{category:'书本'})]);
 assert.deepEqual(new Set(hits.map(m=>m.item.id)),new Set(['black','blue']));
 assert.equal(nextQuestion(c,hits).field,'color');
});

test('地点不确定不会把确定颜色变为软条件',()=>{
 const c=extract('黑色水杯，可能在五餐，也可能在图书馆');
 assert.equal(c.clueHints.color,undefined);assert.equal(rank(c,[item('white',{color:'白色'})]).length,0);
});

test('颜色纠正、确认、遗忘和明确排除分别改变约束',()=>{
 let c=extract('水杯，可能黑色或蓝色');
 c=extract('不是黑色，是蓝色',c);assert.equal(c.color,'蓝色');assert.equal(c.clueHints.color,undefined);
 assert.deepEqual(rank(c,[item('black'),item('blue',{color:'蓝色'})]).map(m=>m.item.id),['blue']);
 c=extract('颜色不记得了',c);assert.equal(c.color,'');assert.equal(c.clueHints.color.state,'unknown');
 assert.equal(rank(c,[item('black'),item('blue',{color:'蓝色'})]).length,2);
 const confirmed=extract('不是黑色',extract('蓝色水杯'));
 assert.deepEqual(rank(confirmed,[item('black'),item('blue',{color:'蓝色'}),item('white',{color:'白色'})]).map(m=>m.item.id),['blue']);
 c=extract('不是黑色',c);assert.equal(c.clueHints.color.state,'excluded');
 assert.deepEqual(rank(c,[item('black'),item('blue',{color:'蓝色'})]).map(m=>m.item.id),['blue']);
});

test('可能线索不符时保留其他多项吻合候选，并明确展示差异',()=>{
 const c=extract('象印水杯，可能黑色，五餐二楼，带吸管和贴纸');
 const m=rank(c,[item('white',{color:'白色'})])[0];assert.ok(m);
 assert.ok(m.conflicts.some(s=>s.includes('颜色')&&s.includes('尚未确定')));
 assert.ok(m.reasons.includes('品牌一致'));assert.equal(m.matchedFields,4);
 assert.equal(rank(extract('象印黑色水杯'),[item('white',{color:'白色'})]).length,0);
});

test('缺少登记信息不会超过多项实际吻合；外观逐项解释',()=>{
 const c=extract('象印黑色水杯，五餐二楼，带吸管和贴纸');
 const hits=rank(c,[item('sparse',{brand:'',color:'',description:'一个杯子'}),item('rich',{description:'带吸管'})]);
 assert.equal(hits[0].item.id,'rich');assert.ok(hits[0].pending.includes('外观待核实：贴纸'));
 assert.ok(hits[1].pending.includes('拾获记录未登记品牌'));
 assert.equal(hits[1].conflicts.length,0);assert.ok(hits[0].score>hits[1].score);
});

test('记不清品牌后仍可询问颜色，不重复品牌，也不重复已忘记的颜色',()=>{
 const matches=[{item:item('a')},{item:item('b',{brand:'小米',color:'蓝色'})}];
 const c=extract('水杯，品牌不记得');assert.equal(nextQuestion(c,matches).field,'color');
 assert.equal(nextQuestion(extract('颜色也不记得',c),matches),null);
});

test('元数据安全保存、修正和兼容旧任务，不接收任意嵌套字段',()=>{
 const c=extract('水杯，可能黑色或蓝色');const stored=criteriaFrom(c);
 assert.deepEqual(stored.clueHints,c.clueHints);
 const changed=criteriaFrom({color:'白色'},stored);assert.deepEqual(changed.clueHints,{});
 assert.deepEqual(sanitizeClueHints({color:{state:'tentative',options:['黑色','黑色',5]},contact:{state:'unknown',secret:'private'}}),{color:{state:'tentative',options:['黑色']}});
 assert.equal(nextQuestion({category:'水杯',uncertain:true},[{item:item('a')},{item:item('b',{brand:'小米'})}]),null);
});

for(const edition of ['api','local'])test(edition+' 模拟模型：不确定→确认→忘记→重新检索，模型不能擅自收窄可能范围',async()=>{
 const db=database(),original=globalThis.fetch;let turnRequest=0;
 const transport=async()=>Response.json({choices:[{message:++turnRequest%2===1?{role:'assistant',content:null,tool_calls:[{id:'search-'+turnRequest,type:'function',function:{name:'search_found_items',arguments:JSON.stringify({category:'水杯',color:'黑色',brand:'象印'})}}]}:{role:'assistant',content:'请对照公开线索并核实，可能的颜色仍待确认。'}}]});
 globalThis.fetch=transport;
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic-key'};
 const s=service(db,'lin','demo:uncertainty',env),h=service(db,'zhou','demo:uncertainty',env);
 try{
  for(const color of ['黑色','蓝色'])await h.createItem({title:color+'合成杯',category:'水杯',color,brand:'象印',location:'五餐二楼',description:'仅合成数据，带吸管',custody:'合成保管人',privateNote:'不得公开的合成凭据',contact:'合成联系方式'});
  const a=await runChat(s,{text:'五餐二楼丢了水杯，可能黑色或蓝色，品牌记不清'});
  assert.equal(a.mode,'model');assert.equal(a.matches.length,2);assert.equal(a.criteria.clueHints.brand.state,'unknown');
  assert.equal(JSON.stringify(a.matches).includes('合成联系方式'),false);
  const b=await runChat(s,{taskId:a.taskId,text:'我确认颜色是蓝色'});
  assert.equal(b.matches.length,1);assert.equal(b.matches[0].item.body.color,'蓝色');assert.equal(b.criteria.clueHints.color,undefined);
  const again=await runChat(s,{taskId:a.taskId,text:'按当前条件继续查找'});
  assert.equal(again.matches.length,1);assert.equal(again.criteria.color,'蓝色');
  const c=await runChat(s,{taskId:a.taskId,text:'刚才记错了，颜色不记得了'});
  assert.equal(c.matches.length,2);assert.equal(c.criteria.clueHints.color.state,'unknown');
  assert.equal((await s.task(a.taskId)).body.criteria.color,'');
 }finally{globalThis.fetch=original;db.raw.close();}
});

test('规则流程：模糊寻找、排除恢复、订阅及后来线索沿用同一条件',async()=>{
 const db=database(),s=service(db),h=service(db,'zhou');
 const publish=(color)=>h.createItem({title:color+'合成杯',category:'水杯',color,location:'五餐二楼',description:'合成吸管杯',custody:'合成保管人'});
 try{
  await publish('黑色');await publish('蓝色');
  const a=await runChat(s,{text:'五餐二楼丢了水杯，可能黑色或蓝色，品牌不记得'});
  assert.equal(a.mode,'rules');assert.equal(a.matches.length,2);
  const b=await runChat(s,{taskId:a.taskId,text:'排除第1条'});assert.equal(b.matches.length,1);
  const c=await runChat(s,{taskId:a.taskId,text:'恢复第1条'});assert.equal(c.matches.length,2);
  await runChat(s,{taskId:a.taskId,text:'请持续留意新线索'});
  const late=await publish('蓝色');const bootstrap=await s.bootstrap();
  assert.ok(bootstrap.notifications.some(n=>n.body.itemId===late.id));
  assert.equal((await s.task(a.taskId)).body.criteria.clueHints.color.state,'tentative');
 }finally{db.raw.close();}
});

test('模糊匹配仍尊重已排除、已归还和跨空间隔离',async()=>{
 const c=extract('水杯，可能黑色或蓝色');assert.equal(rank(c,[item('a')],['a']).length,0);
 assert.equal(rank(c,[item('a',{status:'returned'})]).length,0);
 const db=database(),s=service(db),other=service(db,'zhou','demo:another');
 try{
  await other.createItem({title:'蓝色杯',category:'水杯',color:'蓝色',location:'五餐二楼',description:'合成',custody:'合成保管人'});
  const r=await runChat(s,{text:'水杯，可能黑色或蓝色'});assert.equal(r.matches.length,0);
 }finally{db.raw.close();}
});

 test('补充外观保留旧特征；否定后移除旧线索，不把颜色可能性扩散到类别',()=>{
  let c=extract('水杯，带吸管');c=extract('还有贴纸',c);assert.equal(c.feature,'吸管、贴纸');
  c=extract('记错了，没有吸管',c);assert.equal(c.feature,'贴纸');
  c=extract('外观特征记不清',c);assert.equal(c.feature,'');
  assert.equal(extract('可能黑色的水杯').clueHints.category,undefined);
  assert.equal(extract('可能是水杯或雨伞').clueHints.category.state,'tentative');
 });

test('刷新历史仍保留当轮模糊匹配依据，不按后来的确定条件重写',async()=>{
 const db=database(),s=service(db),h=service(db,'zhou');
 try{
  await h.createItem({title:'合成黑杯',category:'水杯',color:'黑色',location:'五餐二楼',description:'合成杯',custody:'本人'});
  const a=await runChat(s,{text:'水杯，可能黑色或蓝色，带吸管'});
  await runChat(s,{taskId:a.taskId,text:'我确认是蓝色'});
  const res=await handleApi(new Request('http://localhost/api/chat/history?taskId='+encodeURIComponent(a.taskId)),s);
  const turns=(await res.json()).messages.filter(m=>m.role==='assistant');
  assert.equal(turns[0].matches.length,1);assert.equal(turns[1].matches.length,0);
  assert.ok(turns[0].matches[0].reasons.includes('颜色符合可能范围'));
  assert.ok(turns[0].matches[0].pending.includes('外观待核实：吸管'));
  assert.equal(turns[0].historical,true);
 }finally{db.raw.close();}
});
