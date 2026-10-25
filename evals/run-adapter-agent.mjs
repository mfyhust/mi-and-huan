// Actual foundation-model worker -> unchanged own Agent -> synthetic SQLite state checks.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync,mkdirSync,openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {openDatabase} from '../offline/storage.mjs';
import {Store} from '../lib/store.mjs';
import {Service} from '../lib/service.mjs';
import {runChat} from '../lib/agent.mjs';
import {adapterStateCases} from './adapter-state-cases.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

// Isolated fixtures only: pair record identities without exposing case/variant labels.
export class EvaluationStore extends Store{
 constructor(db){super(db,'demo:state-eval');this.counts=new Map();}
 record(kind,owner,body,suffix){
  const index=(this.counts.get(kind)||0)+1;this.counts.set(kind,index);
  const opaque=createHash('sha256').update('state-eval-fixture:'+kind+':'+index).digest('hex').slice(0,24);
  const record=super.record(kind,owner,body,suffix||'record-'+opaque);
  if(kind==='item')record.created=record.updated=new Date(Date.UTC(2026,9,1)+index*1000).toISOString();
  return record;
 }
}

export function parseArgs(argv){
 const args={run:false,suite:'smoke',variant:'both',maxSeconds:600,python:join(root,'.training-runtime/venv/bin/python')};
 const fields={'--suite':'suite','--case':'caseId','--variant':'variant','--max-seconds':'maxSeconds','--python':'python','--base-model':'base','--adapter':'adapter','--output':'output'};
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--run'){args.run=true;continue;}
  const key=fields[argv[i]];if(!key||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('无效参数：'+argv[i]);
  args[key]=argv[++i];
 }
 args.maxSeconds=Number(args.maxSeconds);
 if(!['smoke','focus'].includes(args.suite)||!['both','base','adapter'].includes(args.variant)||!Number.isInteger(args.maxSeconds)||args.maxSeconds<60||args.maxSeconds>1800)throw new Error('无效评测范围或预算');
 if(args.caseId&&(args.suite!=='focus'||!adapterStateCases.some(c=>c.id===args.caseId)))throw new Error('指定场景必须属于focus评测组');
 if(args.run&&(!args.base||!args.output||args.variant!=='base'&&!args.adapter))throw new Error('真实评测必须指定本机权重、适配器和新的输出目录');
 return args;
}

function startWorker(args,variant,remaining){
 const log=join(args.output,variant+'-worker.log');const fd=openSync(log,'wx',0o600);
 const command=[join(root,'training/foundation_worker.py'),'--run','--base-model',resolve(args.base),'--variant',variant,'--max-seconds',String(Math.max(60,remaining))];
 if(variant==='adapter')command.push('--adapter',resolve(args.adapter));
 const child=spawn(args.python,command,{cwd:root,stdio:['pipe','pipe',fd],env:{...process.env,CUDA_VISIBLE_DEVICES:'0',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'}});closeSync(fd);
 let pending=null,readyResolve,readyReject,sequence=0,exitResolve;
 const exited=new Promise(resolve=>{exitResolve=resolve;});
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const fail=error=>{readyReject(error);if(pending){pending.reject(error);pending=null;}};
 child.on('error',fail);
 child.stdin.on('error',fail);
 child.on('close',(code,signal)=>{fail(new Error('本机模型进程结束：'+(signal||code)+'；日志 '+log));exitResolve();});
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{
  try{
   const message=JSON.parse(line);
   if(message.type==='ready'){
    if(message.realModelLoaded!==true||message.variant!==variant)throw new Error('模型就绪证据不匹配');
    readyResolve(message);return;
   }
   if(!pending||message.id!==pending.id)throw new Error('本机协议请求编号不匹配');
   const request=pending;pending=null;
   if(message.error)request.reject(new Error(message.error));else request.resolve(message);
  }catch(error){fail(error);child.kill('SIGTERM');}
 });
 return {ready,async request(payload,signal){
  if(pending)throw new Error('禁止并发本机模型请求');
  if(signal?.aborted)throw signal.reason;
  const id=++sequence;
  const onAbort=()=>{fail(new Error('模型调用已取消'));child.kill('SIGTERM');};
  signal?.addEventListener('abort',onAbort,{once:true});
  try{
   return await new Promise((resolve,reject)=>{
    pending={id,resolve,reject};child.stdin.write(JSON.stringify({id,payload})+'\n',error=>{if(error)fail(error);});
   });
  }finally{signal?.removeEventListener('abort',onAbort);}
 },async stop(){
  child.stdin.end();
  const timeout=setTimeout(()=>child.kill('SIGKILL'),3000);timeout.unref();
  await exited;clearTimeout(timeout);lines.close();
 },kill(){child.kill('SIGTERM');}};
}

export async function runStateCases({definitions,transport,variant,deadline}){
 const cases=[];
 for(const definition of definitions){
  const db=openDatabase(':memory:'),turns=[];let taskId;
  const env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'local-foundation-eval',LOCAL_MODEL_FETCH:transport};
  const store=new EvaluationStore(db);
  const s=new Service(store,{actor:'lin',role:'member',profile:{name:'合成失主'},demo:true,env});
  const holder=new Service(store,{actor:'zhou',role:'member',profile:{name:'合成拾物者'},demo:true,env});
  const c={s,item(extra={}){return holder.createItem({title:'合成黑色水杯',category:'水杯',color:'黑色',location:'五餐二楼',description:'仅合成评测物品',custody:'合成保管处',privateNote:'不可向模型公开的合成标记',...extra});},async chat(text){
   if(Date.now()>=deadline)throw new Error('总预算耗尽');
   const r=await runChat(s,{text,...taskId?{taskId}:{}});taskId=r.taskId;
   turns.push({input:text,mode:r.mode,errorCode:r.modelErrorCode,reply:r.message,criteria:r.criteria,candidateIds:r.matches.map(m=>m.item.id),tools:r.toolExecutions,execution:r.execution,elapsedMs:r.elapsedMs});
   assert.equal(r.mode,'model',r.modelError||'规则降级不算模型通过');assert.ok(r.execution.modelRequests>0);return r;
  }};
  try{await definition.run(c);cases.push({id:definition.id,passed:true,turns});}
  catch(error){cases.push({id:definition.id,passed:false,error:String(error.message).slice(0,500),turns});}
  finally{db.close();}
 }
 return cases;
}

async function main(){
 const args=parseArgs(process.argv.slice(2));
 if(!args.run){console.log(JSON.stringify({runsModel:false,transport:'local-child-process',suite:args.suite,variant:args.variant,maxSeconds:args.maxSeconds,productionAgentExecuted:false},null,2));return;}
 args.output=resolve(args.output);if(existsSync(args.output))throw new Error('输出目录已存在，不能覆盖');
 mkdirSync(args.output,{recursive:true,mode:0o700});
 const started=Date.now(),deadline=started+args.maxSeconds*1000;let worker,requests=0;
 const report={kind:'foundation-worker-agent-state-evaluation',evaluatorVersion:3,identityPolicy:'paired-opaque-records-no-case-or-variant-label',syntheticOnly:true,fixtureOnly:false,productionAgentExecuted:false,realModelInferenceSucceeded:false,externalNetworkRequests:0,testSetRead:false,adapterDeployed:false,qualityImproved:null,suite:args.suite,selectedCase:args.caseId||null,variants:[],requests:0,
  note:'真实基础模型决策经自研Agent执行；开发用少量合成场景，非独立校园质量测试，非新适配器断网验收。',sourceSha256:Object.fromEntries(['lib/agent.mjs','lib/service.mjs','evals/run-adapter-agent.mjs','evals/adapter-state-cases.mjs','training/foundation_worker.py','training/tool_protocol.py','training/message_templates.py','training/train_lora.py'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]))};
 const timer=setTimeout(()=>worker?.kill(),args.maxSeconds*1000);timer.unref();
 try{
  const definitions=args.caseId?adapterStateCases.filter(c=>c.id===args.caseId):args.suite==='smoke'?adapterStateCases.slice(0,1):adapterStateCases;
  for(const variant of args.variant==='both'?['base','adapter']:[args.variant]){
   if(deadline-Date.now()<60000)throw new Error('剩余预算不足以启动下一模型');
   worker=startWorker(args,variant,Math.floor((deadline-Date.now())/1000));
   const metadata=await worker.ready;const entry={variant,metadata,cases:[]};report.variants.push(entry);
   console.log(JSON.stringify({variant,modelReady:true,gpu:metadata.gpu,dtype:metadata.dtype}));
   const transport=async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');
    if(requests>=64||Date.now()>=deadline)throw new Error('总评测预算耗尽');requests++;
    const payload=JSON.parse(options.body);assert.equal(JSON.stringify(payload).includes('不可向模型公开的合成标记'),false);
    let result;
    try{result=await worker.request(payload,options.signal);}
    catch(error){
     entry.workerErrors??=[];
     entry.workerErrors.push({request:requests,message:String(error.message).slice(0,400)});
     throw error;
    }
    report.realModelInferenceSucceeded=true;
    entry.generationMetrics??=[];entry.generationMetrics.push(result.metrics);
    return Response.json({choices:[{message:result.message}]});
   };
   report.productionAgentExecuted=true;
   entry.cases=await runStateCases({definitions,transport,variant,deadline});
   entry.summary={cases:entry.cases.length,passed:entry.cases.filter(c=>c.passed).length,failed:entry.cases.filter(c=>!c.passed).length};
   console.log(JSON.stringify({variant,...entry.summary}));
   await worker.stop();worker=null;
  }
  report.status='completed';
 }catch(error){report.status='failed';report.error=String(error.message).slice(0,500);process.exitCode=1;}
 finally{
  clearTimeout(timer);if(worker)await worker.stop();
  report.requests=requests;report.elapsedMs=Date.now()-started;
  writeFileSync(join(args.output,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:report.status,report:join(args.output,'report.json'),requests,elapsedMs:report.elapsedMs}));
 }
 if(report.variants.some(v=>v.summary?.failed))process.exitCode=1;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
