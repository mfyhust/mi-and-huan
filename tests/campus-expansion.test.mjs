import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CAMPUS_PLACES,resolveCampusLocation,compareCampusLocation,unknownLocationMention} from '../lib/campus-locations.mjs';
import {detectPlaceTeaching} from '../lib/place-learning.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';

test('公开清单扩充宿舍、科研楼、道路、校门；编号不当楼层，不补齐缺号',()=>{
 for(const [query,id] of [['东33二楼','dorm:east:33'],['D35三楼','dorm:east:35'],['西43B二楼','dorm:west:43b'],['博士生公寓10号楼','dorm:phd:10'],['微电子楼','academic:microelectronics'],['文选楼','academic:wenxuan'],['北3门','gate:north3'],['文治大道','road:energy:2']])assert.equal(resolveCampusLocation(query).places[0]?.id,'sjtu-mh:'+id,query);
 assert.deepEqual(resolveCampusLocation('东33号学生公寓').places[0].floors,[]);
 assert.deepEqual(resolveCampusLocation('东33二楼').places[0].floors,[2]);
 for(const query of ['东36','东350','D350','西75','西430','X430'])assert.equal(resolveCampusLocation(query).places.length,0,query);
});
test('楼群与具体楼栋仅作范围吻合，同楼群不同楼栋仍保留冲突',()=>{
 const parent=resolveCampusLocation('电信群楼'),a=resolveCampusLocation('电院1号楼'),b=resolveCampusLocation('电院3号楼');
 assert.equal(a.places.length,1);assert.deepEqual(a.places[0].floors,[]);
 assert.match(compareCampusLocation(parent,a).reasons.join(''),/具体楼栋待核实/);
 assert.equal(compareCampusLocation(a,b).conflicts.includes('校园建筑不同'),true);
});
test('未知地点不限楼馆后缀，保留原话且不误学泛称、品牌或外校区',()=>{
 for(const [text,name] of [['在星河小径门口丢了钥匙','星河小径'],['我在猫窝二楼丢了杯子','猫窝'],['落在拾光咖啡店','拾光咖啡店'],['我在东36号楼二楼丢了杯子','东36号楼']]){
  assert.equal(unknownLocationMention(text)?.name,name,text);assert.equal(detectPlaceTeaching(text)?.name,name,text);
 }
 for(const text of ['品牌简称小米','我在图书馆丢了钥匙','我在某栋楼丢了杯子','我在徐汇新楼丢了杯子','星禾书店在哪里'])assert.equal(unknownLocationMention(text),null,text);
});
test('无楼层未知地点主动保存原话、生成草稿，确认前不能冒充已知地点',async()=>{
 const db=database(),s=service(db);try{
  const r=await runChat(s,{text:'我在猫窝丢了黑色杯子'});assert.equal(r.learningProposal.name,'猫窝');assert.equal(r.learningProposal.status,'pending');assert.equal(r.criteria.locationInfo.status,'unmapped');assert.match(r.criteria.location,/猫窝/);
  const k=await s.placeMemory.list();assert.equal(k.observations.length,1);assert.equal(k.observations[0].raw,'猫窝');assert.equal(k.observations[0].sourceText,undefined);assert.equal(k.memories.length,0);
  assert.equal((await service(db,'zhou').placeMemory.list()).observations.length,0);
  await runChat(s,{taskId:r.taskId,text:'确认记住'});assert.equal((await s.placeMemory.list()).observations[0].recognitionStatus,'resolved');const next=await runChat(s,{text:'猫窝二楼丢了黑色杯子'});assert.equal(next.criteria.locationInfo.places[0].learned,true);assert.deepEqual(next.criteria.locationInfo.places[0].floors,[2]);
 }finally{db.raw.close();}
});
test('未知地点原话跨数据库重启保存，拾获与保管地点分开且不自动学保管位置',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'migui-unknown-place-'));let db=database(join(dir,'data.sqlite'));
 try{const s=service(db,'zhou');await s.createItem({title:'合成杯',category:'水杯',location:'拾光咖啡店二楼',description:'仅测试',custody:'临时收纳站'});const k=await s.placeMemory.list();assert.equal(k.observations.length,1);assert.match(k.observations[0].raw,/拾光咖啡店/);assert.equal(k.observations[0].raw.includes('临时收纳站'),false);db.raw.close();db=database(join(dir,'data.sqlite'),false);const restored=await service(db,'zhou').placeMemory.list();assert.equal(restored.observations.length,1);assert.equal(restored.memories.length,0);
 }finally{db.raw.close();rmSync(dir,{recursive:true});}
});
test('新地点观察去重，范围和知识来源区分，用户输入不能新增官方地点',async()=>{
 const db=database(),s=service(db);try{
  const a=await s.placeMemory.observe('星河小径',{candidateName:'星河小径'}),b=await s.placeMemory.observe('星河小径',{candidateName:'星河小径'});assert.equal(a.id,b.id);assert.equal((await s.placeMemory.list()).observations.length,1);
  assert.equal(await s.placeMemory.observe('徐汇新楼'),null);assert.equal(await s.placeMemory.observe('五餐'),null);
  const p=await s.placeMemory.propose({name:'星河小径'});await s.placeMemory.confirm(p.id);const info=await s.lookupPlace('星河小径');assert.equal(info.records[0].source.type,'user-confirmed');assert.equal(info.records[0].coordinates,null);assert.equal(CAMPUS_PLACES.length,211);
 }finally{db.raw.close();}
});

test('未收录地点保留不确定性，否定地点与外校区不能冒充闵行已知楼',async()=>{
 const db=database(),s=service(db);try{
  const r=await runChat(s,{text:'可能在猫窝丢了黑色杯子，具体楼层不记得'});assert.equal(r.criteria.locationInfo.uncertain,true);assert.match(r.criteria.locationInfo.raw,/可能/);assert.equal(r.learningProposal.name,'猫窝');
  assert.equal(unknownLocationMention('不在星河小径丢了钥匙'),null);
  for(const query of ['张江校区微电子楼','华东师大闵行校区图书馆'])assert.equal(resolveCampusLocation(query).status,'outside_scope');
 }finally{db.raw.close();}
});
