import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTime,sanitizeDateRange,compareItemDate,validDay} from '../lib/time-clues.mjs';
import {extract,rank,nextQuestion,clueLabel} from '../lib/matching.mjs';
import {criteriaFrom} from '../lib/service.mjs';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
const now=new Date('2026-10-21T16:30:00Z'); // Shanghai Oct 22, independent of host timezone.
const item=(id,body={})=>({id,owner:'synthetic-holder',body:{category:'水杯',color:'黑色',brand:'象印',date:'2026-10-21',location:'五餐二楼',description:'合成杯',status:'available',...body}});

test('上海日期跨UTC午夜仍正确，相对区间包含两端日期',()=>{
 assert.deepEqual(extractTime('前天到昨天',now),{date:'',dateRange:{start:'2026-10-20',end:'2026-10-21'},dateUnknown:false});
 assert.equal(extractTime('今天',now).date,'2026-10-22');
 assert.deepEqual(extractTime('近三天',now).dateRange,{start:'2026-10-20',end:'2026-10-22'});
 assert.deepEqual(extractTime('近1天',now).dateRange,{start:'2026-10-22',end:'2026-10-22'});
});

test('明确日期范围、日期二选一、范围改为单日',()=>{
 assert.deepEqual(extractTime('2026-10-20至2026-10-22',now).dateRange,{start:'2026-10-20',end:'2026-10-22'});
 assert.deepEqual(extractTime('前天或昨天',now).dateRange,{start:'2026-10-20',end:'2026-10-21'});
 const range=extract('水杯，前天到昨天',{},undefined,now);
 const c=extract('确定是今天',range,undefined,now);assert.equal(c.date,'2026-10-22');assert.equal(c.dateRange,null);
});

test('日期纠正避开被否定的旧日期',()=>{
 assert.equal(extractTime('不是昨天，是前天',now).date,'2026-10-20');
 assert.equal(extractTime('不是2026-10-20，是2026-10-21',now).date,'2026-10-21');
});

test('无效、倒置、过长范围和无日期语句不伪造新时间条件',()=>{
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2024-02-29'),true);
 for(const text of ['2026-02-30','2026-10-23到2026-10-20','2025-01-01到2026-10-22','近99天','只是问一下进度'])assert.deepEqual(extractTime(text,now),{},text);
 assert.equal(sanitizeDateRange({start:'2026-10-22',end:'no date'}),null);
 assert.equal(sanitizeDateRange({start:'2026-10-22',end:'2026-10-20'}),null);
});

test('遗忘日期清除原时间范围，UI清楚区分未知和区间',()=>{
 let c=extract('水杯，近三天',{},undefined,now);assert.equal(clueLabel(c,'date'),'2026-10-20 至 2026-10-22');
 c=extract('日期不记得了',c,undefined,now);assert.equal(c.date,'');assert.equal(c.dateRange,null);assert.equal(c.dateUnknown,true);
 assert.equal(clueLabel(c,'date'),'记不清，暂不限定');
 c=extract('2026-10-21',c,undefined,now);assert.equal(c.dateUnknown,false);assert.equal(clueLabel(c,'date'),'2026-10-21');
});

test('时间比较遵守先遗失后拾获：早于遗失记为差异，范围内吻合',()=>{
 const c={dateRange:{start:'2026-10-20',end:'2026-10-22'}};
 assert.equal(compareItemDate(c,'2026-10-21').gain,8);
 assert.ok(compareItemDate(c,'2026-10-19').conflict.includes('早于'));
 assert.ok(compareItemDate(c,'2026-10-23').gain>0);
 assert.ok(compareItemDate(c,'2026-11-20').conflict.includes('间隔较大'));
 assert.ok(compareItemDate(c,'').pending);assert.ok(compareItemDate(c,'2026-02-30').pending);
 assert.equal(compareItemDate({...c,dateUnknown:true},'2026-10-21'),null);
});

test('时间区间排序不把丢失前的旧拾获记录当作时间吻合',()=>{
 const c=extract('水杯，2026-10-20到2026-10-22');
 const hits=rank(c,[item('too-early',{date:'2026-10-19'}),item('inside',{date:'2026-10-20'}),item('later',{date:'2026-10-23'}),item('missing',{date:''})]);
 assert.equal(hits[0].item.id,'inside');assert.equal(hits[1].item.id,'later');
 assert.ok(hits.find(m=>m.item.id==='too-early').conflicts.some(s=>s.includes('早于')));
 assert.ok(hits.find(m=>m.item.id==='missing').pending.some(s=>s.includes('日期')));
});

test('日期范围持久化只保留合法边界，兼容旧日期条件',()=>{
 const c=criteriaFrom({dateRange:{start:'2026-10-20',end:'2026-10-22',private:'discard'},dateUnknown:false});
 assert.deepEqual(c.dateRange,{start:'2026-10-20',end:'2026-10-22'});
 assert.equal(criteriaFrom({date:'2026-10-21'},c).dateRange,null);
 assert.equal(criteriaFrom({dateRange:{start:'bad',end:'bad'}}).dateRange,null);
 assert.equal(criteriaFrom({dateUnknown:'true'}).dateUnknown,false);
});

test('信息增益优先询问更能区分候选的颜色，不固定先品牌',()=>{
 const matches=[item('1',{brand:'象印',color:'黑色'}),item('2',{brand:'象印',color:'黑色'}),item('3',{brand:'象印',color:'蓝色'}),item('4',{brand:'小米',color:'蓝色'})].map(item=>({item}));
 const q=nextQuestion({category:'水杯'},matches);assert.equal(q.field,'color');assert.equal(q.strategy,'candidate-information-gain');assert.equal(q.knownCandidates,4);
 assert.ok(q.text.includes('黑色、蓝色'));
});

test('缺失登记降低追问价值；信息更多的品牌也可优先',()=>{
 const matches=[item('1',{brand:'象印',color:'黑色'}),item('2',{brand:'小米',color:'黑色'}),item('3',{brand:'富光',color:'黑色'}),item('4',{brand:'华为',color:'蓝色'})].map(item=>({item}));
 assert.equal(nextQuestion({category:'水杯'},matches).field,'brand');
 matches[1].item.body.brand='';matches[2].item.body.brand='';
 assert.equal(nextQuestion({category:'水杯'},matches).field,'color');
});

test('追问继续尊重已确认值、记不清和地点层级，不索取私密凭据',()=>{
 const matches=[item('1'),item('2',{brand:'小米',color:'蓝色'})].map(item=>({item}));
 assert.equal(nextQuestion(extract('水杯，品牌不记得'),matches).field,'color');
 assert.equal(nextQuestion(extract('水杯，颜色和品牌都不记得'),matches),null);
 assert.equal(nextQuestion({category:'水杯',color:'黑色'},matches).field,'brand');
 assert.equal(nextQuestion({category:'水杯'},[matches[0]]),null);
});

for(const edition of ['api','local'])test(edition+' 模拟工具：保留区间，支持确认、遗忘、追问建议与订阅新线索',async()=>{
 const db=database(),oldFetch=globalThis.fetch;let n=0;let capturedSuggestion;
 const transport=async(url,options)=>{
  const input=JSON.parse(options.body);n++;
  if(n%3===0)return Response.json({choices:[{message:{role:'assistant',content:'已按实际条件查询，请继续核对公开特征。'}}]});
  const name=n%3===1?'get_search_task':'search_found_items';
  if(n%3===2)capturedSuggestion=JSON.parse(input.messages.at(-1).content).clarificationSuggestion;
  return Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'t-'+n,type:'function',function:{name,arguments:JSON.stringify(name==='get_search_task'?{}:{category:'水杯',date:'2026-10-20'})}}]}}]});
 };
 globalThis.fetch=transport;
 const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:transport}:{XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_API_KEY:'synthetic'};
 const s=service(db,'lin','demo:time',env),h=service(db,'zhou','demo:time',env);
 const publish=(date,color)=>h.createItem({title:color+'合成杯',category:'水杯',color,date,location:'五餐二楼',description:'合成数据',custody:'合成保管人'});
 try{
  await publish('2026-10-20','黑色');await publish('2026-10-21','蓝色');
  const a=await runChat(s,{text:'水杯，2026-10-20到2026-10-22遗失'});
  assert.equal(a.mode,'model');assert.deepEqual(a.criteria.dateRange,{start:'2026-10-20',end:'2026-10-22'});assert.equal(a.criteria.date,'');
  assert.equal(capturedSuggestion.field,'color');assert.equal(capturedSuggestion.strategy,'candidate-information-gain');
  const b=await runChat(s,{taskId:a.taskId,text:'确认日期2026-10-21'});assert.equal(b.criteria.date,'2026-10-21');assert.equal(b.criteria.dateRange,null);
  const c=await runChat(s,{taskId:a.taskId,text:'日期不记得了'});assert.equal(c.criteria.dateUnknown,true);assert.equal(c.criteria.date,'');
  await s.subscribe(a.taskId);const late=await publish('2026-10-23','黑色');
  assert.ok((await s.bootstrap()).notifications.some(n=>n.body.itemId===late.id));
 }finally{globalThis.fetch=oldFetch;db.raw.close();}
});
