import test from 'node:test';
import assert from 'node:assert/strict';
import {extract,CATEGORIES} from '../lib/matching.mjs';
import {AGENT_TOOLS,runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';

test('known campus cards map to existing category without treating all unknown nouns as other',()=>{
 for(const word of ['校园卡','学生卡','饭卡','一卡通'])assert.equal(extract('五餐二楼遗失绿色'+word).category,'其他');
 assert.equal(extract('五餐二楼丢了东西').category,undefined);
 assert.deepEqual(AGENT_TOOLS.find(t=>t.function.name==='search_found_items').function.parameters.properties.category.enum,CATEGORIES);
 assert.deepEqual(AGENT_TOOLS.find(t=>t.function.name==='update_search_criteria').function.parameters.properties.category.enum,[...CATEGORIES,'']);
});

test('category constraints retain explicit clearing of an existing category',async()=>{
 const db=database();let count=0;
 const env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:async()=>Response.json({choices:[{message:++count===1?{role:'assistant',content:null,tool_calls:[{id:'clear-category',type:'function',function:{name:'update_search_criteria',arguments:JSON.stringify({category:''})}}]}:{role:'assistant',content:'类别已清空，其他条件保留。'}}]})};
 const s=service(db,'lin','demo:clear-category',env);
 try{
  const task=await s.newTask({text:'绿色校园卡',criteria:{category:'其他',color:'绿色'}});
  const r=await runChat(s,{text:'请清空已有类别条件，保留颜色。',taskId:task.id});
  assert.equal(r.mode,'model');assert.equal(r.criteria.category,'');assert.equal(r.criteria.color,'绿色');
  assert.equal(r.toolExecutions[0].status,'completed');
 }finally{db.raw.close();}
});

test('invalid model category is rejected; corrected category retrieves actual campus card',async()=>{
 for(const edition of ['local','api']){
  const db=database();let count=0;const original=globalThis.fetch;
  const transport=async(url,options)=>{
   const payload=JSON.parse(options.body);count++;
   const message=count<3?{role:'assistant',content:null,tool_calls:[{id:'category-'+count,type:'function',function:{name:'search_found_items',arguments:JSON.stringify({category:count===1?'校园卡':'其他',color:'绿色',location:'五餐二楼'})}}]}:{role:'assistant',content:'找到一条校园卡候选，请由保管人核实。'};
   if(count===2)assert.ok(payload.messages.some(m=>m.role==='tool'&&m.content.includes('系统给定值')));
   return Response.json({choices:[{message}]});
  };
  globalThis.fetch=transport;
  const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic-key'};
  const s=service(db,'lin','demo:categories',env),holder=service(db,'zhou','demo:categories',env);
  try{
   const card=await holder.createItem({title:'合成校园卡',description:'仅合成测试卡片',category:'其他',color:'绿色',location:'五餐二楼',custody:'合成保管人'});
   await holder.createItem({title:'合成计算器',description:'仅合成测试干扰物',category:'文具',color:'绿色',location:'五餐二楼',custody:'合成保管人'});
   const r=await runChat(s,{text:'五餐二楼丢了绿色校园卡，请查询。'});
   assert.equal(r.mode,'model');assert.equal(r.criteria.category,'其他');
   assert.equal(r.toolExecutions[0].code,'TOOL_ARGUMENTS');assert.equal(r.toolExecutions[0].status,'rejected');
   assert.equal(r.toolExecutions[1].status,'completed');assert.equal(r.matches.length,1);assert.equal(r.matches[0].item.id,card.id);
  }finally{globalThis.fetch=original;db.raw.close();}
 }
});
