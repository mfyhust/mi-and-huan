import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {database,service} from './helpers.mjs';
import {runChat,AGENT_TOOLS} from '../lib/agent.mjs';
import {detectPlaceTeaching,learningReply} from '../lib/place-learning.mjs';
import {resolveCampusLocation,CAMPUS_PLACES} from '../lib/campus-locations.mjs';
import {handleApi} from '../lib/service.mjs';
const teach='记住一个新地点：星禾自习室，简称星窝，在东中院旁边。';
const itemInput=location=>({title:'合成黑杯',category:'水杯',color:'黑色',brand:'学习测试',description:'合成测试',location,custody:'保管人处'});
async function remember(s,input={name:'星禾自习室',aliases:['星窝']}){const p=await s.placeMemory.propose(input);return s.placeMemory.confirm(p.id,{version:p.version});}
async function post(s,path,body){return handleApi(new Request('http://localhost/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),s);}

test('自然教学只生成有原话依据的草稿；强确认后新对话按别名、楼层与区域识别',async()=>{
  const db=database(),s=service(db),original=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('纯教学不应该访问模型');};
  try{
    for(const name of ['青禾餐厅二楼','未名图书馆']){const info=resolveCampusLocation(name);assert.equal(info.status,'unmapped');assert.equal(info.label,name);}
    const parsed=detectPlaceTeaching(teach);assert.equal(parsed.name,'星禾自习室');assert.deepEqual(parsed.aliases,['星窝']);assert.equal(parsed.note,'东中院旁边');
    assert.equal(detectPlaceTeaching('品牌简称小米'),null);
    const draft=await runChat(s,{text:teach});
    assert.equal(draft.execution.modelRequests,0);assert.equal(draft.learningProposal.status,'pending');assert.equal(draft.learningProposal.kind,'study');
    assert.equal((await s.lookupPlace('星窝二楼')).status,'unmapped');assert.equal((await s.placeMemory.list()).memories.length,0);
    assert.equal((await s.bootstrap()).tasks.length,0);await assert.rejects(()=>s.subscribe(draft.taskId),{status:409});
    assert.equal(learningReply('是的'),null);assert.equal(learningReply('不要记住'),'reject');
    const confirmed=await runChat(s,{taskId:draft.taskId,text:'确认记住'});
    assert.equal(confirmed.learningResult.status,'confirmed');assert.equal(confirmed.execution.modelRequests,0);
    const lookup=await s.lookupPlace('星窝二楼靠窗');assert.equal(lookup.status,'resolved');assert.deepEqual(lookup.places[0].floors,[2]);assert.equal(lookup.places[0].detail,'靠窗');
    assert.equal(lookup.records[0].source.type,'user-confirmed');assert.equal(lookup.records[0].coordinates,null);
    globalThis.fetch=original;
    const next=await runChat(service(db),{text:'我在星窝二楼靠窗丢了黑色保温杯'});
    assert.equal(next.criteria.locationInfo.places[0].id,confirmed.learningResult.placeId);assert.deepEqual(next.criteria.locationInfo.places[0].floors,[2]);
    const history=await handleApi(new Request('http://localhost/api/chat/history?taskId='+encodeURIComponent(draft.taskId)),s);
    assert.ok((await history.json()).messages.filter(m=>m.learningProposal).every(m=>m.learningProposal.status==='confirmed'));
  }finally{globalThis.fetch=original;db.raw.close();}
});

test('失物描述能发现未收录地点，拒绝不入库；同一对话可以再次教学',async()=>{
  const db=database(),s=service(db);
  try{
    const result=await runChat(s,{text:'我在星禾自习室二楼丢了黑色杯子'});
    assert.equal(result.learningProposal.name,'星禾自习室');assert.equal(result.criteria.locationInfo.status,'unmapped');
    await runChat(s,{taskId:result.taskId,text:'不要记住'});assert.equal((await s.catalog()).length,CAMPUS_PLACES.length);
    const retry=await runChat(s,{taskId:result.taskId,text:teach});assert.equal(retry.learningProposal.status,'pending');assert.notEqual(retry.learningProposal.id,result.learningProposal.id);
    await runChat(s,{taskId:result.taskId,text:'确认记住'});assert.equal((await s.catalog()).length,CAMPUS_PLACES.length+1);
  }finally{db.raw.close();}
});

test('重启数据库后记忆仍在；旧未知地点记录重解析，订阅按新别名匹配',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xunhui-place-'));let db=database(join(dir,'test.sqlite'));
  try{
    const s=service(db),holder=service(db,'zhou');
    const old=await holder.createItem(itemInput('星窝二楼'));assert.equal(old.body.locationInfo.status,'unmapped');
    const saved=await remember(s);db.raw.close();db=database(join(dir,'test.sqlite'),false);
    const restarted=service(db),task=await restarted.newTask({text:'星禾自习室丢了杯子',criteria:{category:'水杯',color:'黑色',brand:'学习测试',location:'星禾自习室二楼'}});
    const matches=await restarted.candidates(task);assert.equal(matches[0].item.id,old.id);assert.equal(matches[0].item.body.locationInfo.places[0].id,saved.placeId);assert.ok(matches[0].reasons.includes('楼层一致'));
    await restarted.subscribe(task.id);await service(db,'zhou').createItem(itemInput('星窝2F'));
    assert.equal((await restarted.bootstrap()).notifications.length,1);
    const active=(await restarted.placeMemory.list()).memories[0];await restarted.placeMemory.setActive(active.id,false,active.version);
    assert.equal((await restarted.task(task.id)).body.criteria.locationInfo.status,'unmapped');assert.equal((await restarted.item(old.id)).body.locationInfo.status,'unmapped');
    const inactive=(await restarted.placeMemory.list()).memories[0];await restarted.placeMemory.setActive(inactive.id,true,inactive.version);
    assert.equal((await restarted.lookupPlace('星窝')).places[0].id,saved.placeId);
  }finally{db.raw.close();rmSync(dir,{recursive:true,force:true});}
});

test('已有地点只新增有来源的别名；停用错误别名后可教给正确地点，不能恢复冲突记忆',async()=>{
  const db=database(),s=service(db);
  try{
    const learned=await remember(s,{name:'五餐',aliases:'湖边餐厅',note:'用户自定义称呼'});
    assert.equal(learned.placeId,'sjtu-mh:dining:5');assert.equal((await s.catalog()).length,CAMPUS_PLACES.length);
    const lookup=await s.lookupPlace('湖边餐厅二楼');assert.equal(lookup.places[0].id,learned.placeId);assert.equal(lookup.places[0].aliasSource,'user-confirmed');
    const base=(await s.catalog()).find(p=>p.id===learned.placeId);assert.equal(typeof base.source,'string');assert.equal(base.learnedAliases[0].source,'用户确认补充，未经校方核实');
    const task=await s.newTask({text:'找湖边餐厅的杯子',criteria:{category:'水杯',location:'湖边餐厅二楼'}});assert.equal((await s.task(task.id)).body.criteria.locationInfo.places[0].aliasSource,'user-confirmed');
    const memory=(await s.placeMemory.list()).memories[0];await s.placeMemory.setActive(memory.id,false,memory.version);
    assert.equal((await s.task(task.id)).body.criteria.locationInfo.places[0]?.aliasSource,undefined);
    const corrected=await remember(s,{name:'四餐',aliases:['湖边餐厅']});assert.equal(corrected.placeId,'sjtu-mh:dining:4');
    assert.equal((await s.lookupPlace('湖边餐厅')).places[0].id,corrected.placeId);
    const previous=(await s.placeMemory.list()).memories.find(m=>m.id===memory.id);await assert.rejects(()=>s.placeMemory.setActive(previous.id,true,previous.version),{status:409});
  }finally{db.raw.close();}
});

test('草稿本人确认、空间隔离、来源隐藏；非法名称、伪造来源与别名冲突拒绝',async()=>{
  const db=database(),s=service(db);
  try{
    for(const name of ['图书馆','这里','星禾自习室二楼','徐汇新楼'])await assert.rejects(()=>s.placeMemory.propose({name}),{status:400});
    await assert.rejects(()=>s.placeMemory.propose({name:'虚构实验室'},{grounded:true,sourceText:'在星禾自习室丢了杯子'}),{status:400});
    const p=await s.placeMemory.propose({name:'星禾自习室',aliases:['星窝']},{sourceText:'原始私有教学文本'});
    assert.equal(p.sourceText,undefined);assert.equal((await service(db,'zhou').placeMemory.list()).proposals.length,0);
    await assert.rejects(()=>service(db,'zhou').placeMemory.confirm(p.id),{status:404});
    await s.placeMemory.confirm(p.id);assert.equal((await service(db,'zhou').lookupPlace('星窝')).status,'resolved');
    assert.equal((await service(db,'lin','demo:other').lookupPlace('星窝')).status,'unmapped');
    const memory=(await s.placeMemory.list()).memories[0];await assert.rejects(()=>service(db,'zhou').placeMemory.setActive(memory.id,false,memory.version),{status:403});
    await assert.rejects(()=>s.placeMemory.propose({name:'清溪实验室',aliases:['星窝']}),{status:409});
    const alias=await s.placeMemory.propose({name:'星禾自习室',aliases:['禾屋']});await s.placeMemory.confirm(alias.id);
    await s.placeMemory.setActive(memory.id,false,memory.version);const a=(await s.placeMemory.list()).memories.find(m=>m.type==='alias');
    await s.placeMemory.setActive(a.id,false,a.version);const inactive=await s.store.get(a.id);await assert.rejects(()=>s.placeMemory.setActive(a.id,true,inactive.version),{status:409});
  }finally{db.raw.close();}
});

test('确认时允许人工修订草稿，要求版本，重复确认不重复保存',async()=>{
  const db=database(),s=service(db);
  try{
    const p=await s.placeMemory.propose({name:'星禾自习室',aliases:'原简称'});
    assert.equal((await post(s,'places/confirm',{id:p.id})).status,400);
    assert.equal((await post(s,'places/confirm',{id:p.id,version:9})).status,409);
    const res=await post(s,'places/confirm',{id:p.id,version:p.version,name:'星禾学习空间',aliases:'星窝',kind:'study',note:'人工核对说明'});assert.equal(res.status,200);
    const result=await res.json();assert.equal(result.learningResult.name,'星禾学习空间');assert.equal((await s.lookupPlace('原简称')).status,'unmapped');
    await s.placeMemory.confirm(p.id);assert.equal((await s.placeMemory.list()).memories.length,1);
    assert.equal((await s.lookupPlace('星窝')).records[0].name,'星禾学习空间');
  }finally{db.raw.close();}
});

test('并行确认同名草稿幂等；竞争别名仅一条生效，失败草稿与名称不部分落库',async()=>{
  const db=database(),s=service(db),other=service(db,'zhou');
  try{
    const a=await s.placeMemory.propose({name:'星禾自习室',aliases:['星窝']}),b=await other.placeMemory.propose({name:'星禾自习室',aliases:['星窝']});
    const same=await Promise.allSettled([s.placeMemory.confirm(a.id),other.placeMemory.confirm(b.id)]);assert.ok(same.every(x=>x.status==='fulfilled'));
    assert.equal((await s.store.list('place_memory')).length,1);
    const c=await s.placeMemory.propose({name:'清溪实验室',aliases:['共享简称']}),d=await other.placeMemory.propose({name:'望舒实验室',aliases:['共享简称']});
    const conflict=await Promise.allSettled([s.placeMemory.confirm(c.id),other.placeMemory.confirm(d.id)]);assert.equal(conflict.filter(x=>x.status==='fulfilled').length,1);
    assert.equal((await s.store.list('place_memory')).length,2);assert.equal((await s.store.list('_transition')).length,0);
    const loser=conflict[0].status==='rejected'?c:d;assert.equal((await s.store.get(loser.id)).body.status,'pending');assert.equal((await s.lookupPlace(loser.name)).status,'unmapped');
  }finally{db.raw.close();}
});

test('模型可提出有依据的学习草稿，但无确认工具，伪造名称不能进入记忆',async()=>{
  const db=database(),s=service(db),original=globalThis.fetch;let n=0;
  assert.equal(AGENT_TOOLS.some(t=>t.function.name==='confirm_place_learning'),false);
  globalThis.fetch=async(url,options)=>{
    const payload=JSON.parse(options.body);n++;
    if(n===2){const outputs=payload.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));assert.equal(outputs[0].status,'pending');assert.match(outputs[1].error,/不能补造/);assert.equal(outputs[2].error,'未授权的工具。');}
    return Response.json({choices:[{message:n===1?{role:'assistant',content:null,tool_calls:[
      {id:'draft',type:'function',function:{name:'propose_place_learning',arguments:JSON.stringify({name:'星禾自习室',aliases:'星窝'})}},
      {id:'fake',type:'function',function:{name:'propose_place_learning',arguments:JSON.stringify({name:'伪造实验室'})}},
      {id:'commit',type:'function',function:{name:'confirm_place_learning',arguments:'{}'}}
    ]}:{role:'assistant',content:'请核对地点草稿后确认。'}}]});
  };
  try{
    const result=await runChat(s,{text:'朋友提到“星禾自习室”，常用称呼是“星窝”，我想找回水杯。',llm:{provider:'sjtu',key:'test-only'}});
    assert.equal(result.mode,'model',result.modelError);assert.equal(result.learningProposal.name,'星禾自习室');assert.equal((await s.placeMemory.list()).memories.length,0);assert.equal(n,2);
  }finally{globalThis.fetch=original;db.raw.close();}
});
