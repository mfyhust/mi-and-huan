import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {releaseCases} from './release-journey.mjs';
import {journeyCases} from './local-journey.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {openDatabase} from '../offline/storage.mjs';
import {localModelFetch} from '../offline/local-fetch.mjs';
import {readModelInventory,localMetadata} from '../offline/model-inventory.mjs';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
import {Store} from '../lib/store.mjs';
import {Service} from '../lib/service.mjs';
import {runChat} from '../lib/agent.mjs';

export const MODEL='qwen3.5:4b-q4_K_M';
export function evaluationPlan(suite='smoke'){
  if(!['smoke','core','journey','release'].includes(suite))throw new Error('评测组只支持smoke、core、journey或release。');
  return {model:MODEL,suite,syntheticOnly:true,endpoint:'http://127.0.0.1:11434/v1/chat/completions',maxRequests:suite==='smoke'?4:suite==='core'?16:suite==='release'?24:32,maxWallMs:suite==='smoke'?180000:600000,thinking:'none',runsModel:false,requires:'实际推理需显式 --run；不读取用户数据或API私密文件。'};
}
export function parseEvaluationArgs(args){
  let suite='smoke',run=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--run')run=true;
    else if(args[i]==='--suite'&&args[i+1])suite=args[++i];
    else throw new Error('只支持 --run 和 --suite smoke|core|journey|release；不接受地址、密钥或云供应商。');
  }
  evaluationPlan(suite);return {suite,run};
}

export async function evaluateLocalModel({suite='smoke',model=MODEL,transport,inventory}={}){
  const plan=evaluationPlan(suite);resolveModelConfig({XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:model});
  const fixtureOnly=typeof transport==='function';
  if(!fixtureOnly&&!inventory)inventory=await readModelInventory(model);
  const started=Date.now(),deadline=started+plan.maxWallMs;let requests=0;
  const cases=[];
  const definitions=suite==='release'?releaseCases:suite==='journey'?journeyCases:[{id:'search',async run(c){
    const exact=await c.item({location:'五餐二楼'});await c.item({title:'合成蓝伞',category:'雨伞',color:'蓝色',location:'五餐二楼'});
    const r=await c.chat('我在五餐二楼丢了黑色保温杯，请查找已有拾获记录');
    assert.equal(r.matches[0]?.item.id,exact.id,'应查询到合成杯，而不是干扰物品');
    assert.ok(r.toolExecutions.some(t=>t.tool==='search_found_items'&&t.status==='completed'),'必须实际执行搜索工具，不能以自动刷新或纯文本冒充工具调用');
  }},...suite==='core'?[{id:'floor-correction',async run(c){
    await c.item({location:'五餐二楼'});const exact=await c.item({location:'五餐三楼'});
    await c.chat('五餐二楼丢了黑色保温杯，请查询');const r=await c.chat('刚才记错了，不是二楼，是三楼，请重新查询');
    assert.deepEqual(r.criteria.locationInfo.places[0].floors,[3]);assert.equal(r.matches[0]?.item.id,exact.id);
    assert.ok(r.toolExecutions.some(t=>['search_found_items','update_search_criteria'].includes(t.tool)&&t.status==='completed'));
  }},{id:'subscription',async run(c){
    const r=await c.chat('在五餐丢了黑色保温杯，查一下；如果没有线索，请帮我订阅并持续留意');
    assert.equal(r.matches.length,0);assert.equal(r.subscribed,true);assert.ok(r.toolExecutions.some(t=>t.tool==='subscribe_to_clues'&&t.status==='completed'));
    const item=await c.item({location:'五餐二楼'});assert.ok((await c.s.store.list('notification')).some(n=>n.owner==='lin'&&n.body.itemId===item.id));
  }}]:[]];
  for(const definition of definitions){
    if(Date.now()>=deadline||requests>=plan.maxRequests){cases.push({id:definition.id,passed:false,error:'评测总预算耗尽，未执行',turns:[]});continue;}
    const db=openDatabase(':memory:'),turns=[],facts={};let taskId;
    const env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:model,LOCAL_MODEL_FETCH:async(url,options)=>{
      if(url!==plan.endpoint||requests>=plan.maxRequests||Date.now()>=deadline)throw new Error('评测请求预算耗尽');
      requests++;
      const signal=AbortSignal.any([options.signal,AbortSignal.timeout(Math.max(1,deadline-Date.now()))]);
      return (transport||localModelFetch)(url,{...options,signal});
    }};
    const store=new Store(db,'demo:real-eval:'+crypto.randomUUID()),s=new Service(store,{actor:'lin',role:'member',profile:{name:'合成失主'},demo:true,env}),holder=new Service(store,{actor:'zhou',role:'member',profile:{name:'合成拾物者'},demo:true,env});
    const c={s,holder,fact(key,value){facts[key]=value;},item(extra){return holder.createItem({title:'合成黑色保温杯',category:'水杯',color:'黑色',description:'仅本机小规模评测',custody:'合成拾物者保管',privateNote:'合成非公开标记，不用于模型输入',...extra});},async chat(text){
      const r=await runChat(s,{text,...(taskId?{taskId}:{})});taskId=r.taskId;
      turns.push({input:text,mode:r.mode,errorCode:r.modelErrorCode,reply:r.message,criteria:r.criteria,searchDiagnostics:r.searchDiagnostics,candidateIds:r.matches.map(m=>m.item.id),tools:r.toolExecutions,execution:r.execution,elapsedMs:r.elapsedMs});
      assert.equal(r.mode,'model',r.modelError||'未以模型完成本轮');assert.ok(r.execution.modelRequests>0);
      assert.equal(JSON.stringify(r.matches).includes('合成非公开标记'),false);return r;
    }};
    try{await definition.run(c);cases.push({id:definition.id,passed:true,turns,facts});}
    catch(error){cases.push({id:definition.id,passed:false,error:String(error.message).slice(0,500),turns,facts});}
    finally{db.close();}
  }
  const loaded=fixtureOnly?null:await localMetadata('/api/ps').catch(()=>null);
  const sourceSha256=Object.fromEntries(['lib/agent.mjs','lib/model-runtime.mjs','lib/api-pressure.mjs','lib/service.mjs','lib/matching.mjs','lib/time-clues.mjs','lib/search-diagnostics.mjs','lib/campus-locations.mjs','evals/run-local-model.mjs','evals/local-journey.mjs','evals/release-journey.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')]));
  return {sourceSha256,version:JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version,generatedAt:new Date().toISOString(),kind:fixtureOnly?'fixture-test-of-live-runner':'local-model-small-evaluation',fixtureOnly,inventory:inventory||null,model,suite,thinking:'none',maxRequests:plan.maxRequests,maxWallMs:plan.maxWallMs,requests,elapsedMs:Date.now()-started,loadedModels:loaded?.models?.map(m=>({name:m.name,digest:m.digest,size:m.size,sizeVram:m.size_vram}))||[],summary:{cases:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length},cases,disconnectedAccepted:false,note:'仅合成数据、小规模实际模型评测；不代表完整离线或真实校园验收。注入模拟传输时fixtureOnly为true，不能作为实际推理成绩。'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {suite,run}=parseEvaluationArgs(process.argv.slice(2));
  const plan=evaluationPlan(suite);
  if(!run)console.log(JSON.stringify(plan,null,2));
  else{
    const report=await evaluateLocalModel({suite});mkdirSync(new URL('../.offline-evaluations/',import.meta.url),{recursive:true,mode:0o700});
    const path=fileURLToPath(new URL('../.offline-evaluations/'+suite+'-'+Date.now()+'.json',import.meta.url));writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({report:path,model:report.model,requests:report.requests,elapsedMs:report.elapsedMs,...report.summary},null,2));if(report.summary.failed)process.exitCode=1;
  }
}
