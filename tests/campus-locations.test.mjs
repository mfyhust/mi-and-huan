import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPUS_PLACES,PLACE_SOURCES,resolveCampusLocation,locationMention,lookupCampusPlace} from '../lib/campus-locations.mjs';
import {extract,rank,nextQuestion} from '../lib/matching.mjs';
import {database,service} from './helpers.mjs';
import {runChat} from '../lib/agent.mjs';
import {handleApi} from '../lib/service.mjs';

test('扩充地点库有唯一内部ID及官方来源，不包含未经核实坐标或室内布局',()=>{
  assert.equal(CAMPUS_PLACES.length,211);assert.equal(new Set(CAMPUS_PLACES.map(p=>p.id)).size,CAMPUS_PLACES.length);
  for(const p of CAMPUS_PLACES){assert.equal(p.coordinates,null);assert.ok(new URL(PLACE_SOURCES[p.source].url).hostname.endsWith('.sjtu.edu.cn'));}
  const result=lookupCampusPlace('五餐二楼');
  assert.equal(result.places[0].floors[0],2);assert.equal(result.records[0].floorsVerified,false);
  assert.equal(result.records[0].source.checkedAt,'2026-10-23');assert.equal(result.coordinatesAvailable,false);
});
test('第五食堂、五餐与5餐解析为同一建筑；中文、全角、F和地下楼层可识别',()=>{
  for(const [text,level] of [['第五食堂二楼',2],['五餐2F',2],['５餐２Ｆ',2],['第5餐饮大楼第二层',2],['五餐B1',-1],['五餐地下二层',-2]]){
    const info=resolveCampusLocation(text);assert.equal(info.status,'resolved',text);assert.equal(info.places[0].id,'sjtu-mh:dining:5',text);assert.deepEqual(info.places[0].floors,[level],text);
  }
  assert.notEqual(resolveCampusLocation('15餐').places[0]?.id,'sjtu-mh:dining:5');
});
test('建筑名称最长匹配，东上院与上院不混淆；图案和印字不会冒充地点',()=>{
  assert.equal(resolveCampusLocation('东上院三楼').places.length,1);
  assert.equal(resolveCampusLocation('东上院三楼').places[0].name,'东上院');
  assert.equal(locationMention('背包图案有一只小猫'),undefined);
  assert.equal(resolveCampusLocation('杯身印着五餐').places.length,0);
  assert.equal(resolveCampusLocation('徐汇上院二楼').status,'outside_scope');
});
test('单独说图书馆保留三处歧义，一教不伪装成真实交大建筑',()=>{
  const info=resolveCampusLocation('图书馆二楼');assert.equal(info.status,'ambiguous');assert.equal(info.places.length,0);assert.equal(info.candidates.length,3);assert.deepEqual(info.pendingFloors,[2]);
  assert.equal(resolveCampusLocation('一教').places.length,0);
  assert.equal(resolveCampusLocation('一教').label,'第一教学楼');
});
test('连续补充楼层与区域，更正楼层及建筑时不残留旧楼层',()=>{
  const first=resolveCampusLocation('五餐');
  const second=resolveCampusLocation('二楼靠窗',first);assert.equal(second.places[0].name,'第五餐饮大楼');assert.deepEqual(second.places[0].floors,[2]);assert.equal(second.places[0].detail,'靠窗');
  const third=resolveCampusLocation('不是二楼，是三楼',second);assert.deepEqual(third.places[0].floors,[3]);
  const fourth=resolveCampusLocation('不是五餐，是四餐',third);assert.equal(fourth.places[0].name,'第四餐饮大楼');assert.deepEqual(fourth.places[0].floors,[]);
  assert.deepEqual(resolveCampusLocation('不是三楼',third).places[0].floors,[]);
  const other=resolveCampusLocation('材料实验楼二楼',second);assert.equal(other.status,'unmapped');assert.equal(other.places.length,0);assert.equal(other.label,'材料实验楼二楼');
  assert.equal(resolveCampusLocation('东133二楼',second).places.length,0);
});
test('不确定楼层及不同建筑的楼层分别保存，不把一个楼层套到所有地点',()=>{
  assert.deepEqual(resolveCampusLocation('五餐二楼或三楼').places[0].floors,[2,3]);
  const multiple=resolveCampusLocation('可能五餐二楼，也可能四餐三楼');
  assert.deepEqual(multiple.places.map(p=>p.floors),[[2],[3]]);
  const followup=resolveCampusLocation('二楼',resolveCampusLocation('五餐或者四餐'));
  assert.equal(followup.status,'ambiguous');assert.deepEqual(followup.places.map(p=>p.floors),[[],[]]);
  assert.match(nextQuestion({category:'水杯',locationInfo:followup},[]).text,/对应哪一处/);
  const clarified=resolveCampusLocation('五餐',followup);
  assert.equal(clarified.places.length,2);assert.deepEqual(clarified.places.map(p=>p.floors),[[2],[]]);
});
test('用户不记得楼层时清空旧楼层，不再追问；建筑歧义会提出具体选择',()=>{
  const info=resolveCampusLocation('楼层不记得了',resolveCampusLocation('五餐二楼'));
  assert.equal(info.floorUnknown,true);assert.deepEqual(info.places[0].floors,[]);
  assert.equal(resolveCampusLocation('不记得楼层',resolveCampusLocation('五餐二楼')).floorUnknown,true);
  assert.equal(resolveCampusLocation('五餐',info).floorUnknown,true);
  assert.equal(resolveCampusLocation('想起来是二楼',info).floorUnknown,false);
  assert.equal(nextQuestion({category:'水杯',locationInfo:info},[]),null);
  assert.match(nextQuestion({category:'水杯',location:'图书馆'},[]).text,/包玉刚图书馆/);
  const unknown=resolveCampusLocation('不记得哪一座图书馆');assert.equal(unknown.buildingUnknown,true);
  assert.equal(nextQuestion({category:'水杯',locationInfo:unknown},[]),null);
});
const row=(id,location,custody='其他地方保管')=>({id,owner:'holder',body:{category:'水杯',color:'黑色',location,status:'available',custody}});
test('同建筑同楼层优先，楼层未知与不同楼层保留；当前保管地点不参与拾获地点排序',()=>{
  const query={category:'水杯',color:'黑色',location:'五餐二楼'};
  const result=rank(query,[row('other','四餐二楼','五餐二楼'),row('wrong-floor','五餐一楼'),row('unknown-floor','第五食堂'),row('exact','第5食堂2F','四餐')]);
  assert.deepEqual(result.map(r=>r.item.id),['exact','unknown-floor','wrong-floor','other']);
  assert.ok(result[0].reasons.includes('楼层一致'));assert.ok(result.find(r=>r.item.id==='wrong-floor').conflicts.some(s=>s.includes('楼层不同')));
  assert.ok(result.find(r=>r.item.id==='unknown-floor').reasons.includes('拾获楼层未知'));
});
test('位置只有附近时不伪装精确点；未知建筑保存原文；房间号不反推楼层',()=>{
  const nearby=resolveCampusLocation('五餐附近');assert.equal(nearby.places[0].relation,'nearby');
  assert.deepEqual(resolveCampusLocation('东中院102教室').places[0].floors,[]);
  assert.equal(resolveCampusLocation('尚未收录的A楼').status,'unmapped');
});
test('登记与任务的地点由服务端生成；持久化后可继续补充，伪造地点ID不生效',async()=>{
  const db=database(),s=service(db),holder=service(db,'zhou');
  try{
    const item=await holder.createItem({title:'测试杯',category:'水杯',color:'黑色',location:'第五食堂2F靠窗',description:'合成测试杯',custody:'测试保管人带往四餐',locationInfo:{places:[{id:'forged'}]}});
    assert.equal(item.body.locationInfo.places[0].id,'sjtu-mh:dining:5');assert.match(item.body.location,/2楼/);assert.equal(item.body.locationInfo.raw,'第五食堂2F靠窗');
    const task=await s.newTask({text:'找五餐黑杯',criteria:{category:'水杯',color:'黑色',location:'五餐',locationInfo:{places:[{id:'forged'}]}}});
    const updated=await service(db).updateCriteria(task.id,{location:'二楼靠窗'});
    assert.deepEqual(updated.body.criteria.locationInfo.places[0].floors,[2]);
    assert.equal((await s.candidates(updated))[0].item.id,item.id);
    const response=await handleApi(new Request('http://localhost/api/places?query='+encodeURIComponent('五餐二楼')),s);
    assert.equal((await response.json()).records[0].source.checkedAt,'2026-10-23');
  }finally{db.raw.close();}
});
test('规则寻物也保留校园地点，连续补充楼层后影响真实排序，订阅能匹配后到别名线索',async()=>{
  const db=database(),s=service(db),holder=service(db,'zhou');
  try{
    const task=await runChat(s,{text:'五餐黑色保温杯'});
    const next=await runChat(service(db),{text:'二楼靠窗',taskId:task.taskId});
    assert.equal(next.mode,'rules');assert.deepEqual(next.criteria.locationInfo.places[0].floors,[2]);
    await s.subscribe(task.taskId);
    await holder.createItem({title:'合成晚到杯',category:'水杯',color:'黑色',location:'第五食堂2F窗边',description:'测试用',custody:'本人'});
    assert.equal((await s.bootstrap()).notifications.length,1);
  }finally{db.raw.close();}
});
test('模型搜索不能把本轮五餐二楼退化为食堂；地点查询工具有出处且不修改任务',async()=>{
  const db=database(),s=service(db),original=globalThis.fetch;let n=0;
  globalThis.fetch=async(url,options)=>{
    const payload=JSON.parse(options.body);n++;
    if(n===3){const result=JSON.parse(payload.messages.at(-1).content);assert.equal(result.records[0].source.checkedAt,'2026-10-23');}
    const message=n===1?{role:'assistant',content:null,tool_calls:[{id:'search',type:'function',function:{name:'search_found_items',arguments:'{"category":"水杯","location":"食堂"}'}}]}:n===2?{role:'assistant',content:null,tool_calls:[{id:'place',type:'function',function:{name:'resolve_campus_location',arguments:'{"query":"五餐"}'}}]}:{role:'assistant',content:'已保留五餐二楼，等待线索。'};
    return Response.json({choices:[{message}]});
  };
  try{
    const result=await runChat(s,{text:'昨天五餐二楼靠窗丢了保温杯',llm:{provider:'sjtu',key:'test-only'}});
    assert.equal(result.mode,'model');assert.equal(result.criteria.locationInfo.places[0].name,'第五餐饮大楼');assert.deepEqual(result.criteria.locationInfo.places[0].floors,[2]);assert.equal(result.criteria.locationInfo.places[0].detail,'靠窗');assert.equal(result.execution.toolCalls,2);
  }finally{globalThis.fetch=original;db.raw.close();}
});

test('只询问另一处在哪里，不会自动改写正在寻找的地点，模型也不能据此覆盖',async()=>{
  const db=database(),s=service(db),original=globalThis.fetch;let n=0;
  try{
    const first=await runChat(s,{text:'五餐二楼丢了黑色保温杯'});
    assert.equal(locationMention('第四食堂在哪里'),undefined);
    assert.equal(locationMention('不确定五餐在哪里'),undefined);
    assert.notEqual(locationMention('不确定是不是在五餐二楼'),undefined);
    assert.equal(extract('第四食堂在哪里',first.criteria).location,first.criteria.location);
    globalThis.fetch=async()=>{
      const message=++n===1?{role:'assistant',content:null,tool_calls:[{id:'lookup',type:'function',function:{name:'resolve_campus_location',arguments:'{"query":"四餐"}'}},{id:'bad-update',type:'function',function:{name:'update_search_criteria',arguments:'{"location":"四餐"}'}}]}:{role:'assistant',content:'已查询四餐名称，原寻物地点保持五餐二楼。'};
      return Response.json({choices:[{message}]});
    };
    const result=await runChat(s,{taskId:first.taskId,text:'四餐在哪里',llm:{provider:'sjtu',key:'test-only'}});
    assert.equal(result.criteria.locationInfo.places[0].name,'第五餐饮大楼');assert.deepEqual(result.criteria.locationInfo.places[0].floors,[2]);
  }finally{globalThis.fetch=original;db.raw.close();}
});
