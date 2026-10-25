import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openDatabase} from '../offline/storage.mjs';
import {Store} from '../lib/store.mjs';
import {Service} from '../lib/service.mjs';
import {runChat,AGENT_TOOLS} from '../lib/agent.mjs';
import {scenarios} from './offline-scenarios.mjs';

// No socket, global fetch mocking, credential/config loading or live database.
// Only this fixture transport can be used by this executor-evaluation command.
export async function evaluateOffline(){
  const cases=[];
  for(const scenario of scenarios){
    const db=openDatabase(':memory:');
    const turns=[];let script=[],step=0,taskId=null;
    const env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture-only',LOCAL_MODEL_FETCH:async(url,options)=>{
      if(url!=='http://127.0.0.1:11434/v1/chat/completions')throw new Error('评测目的地异常');
      const input=JSON.parse(options.body),next=script[step++];
      if(!next)throw new Error('合成协议脚本耗尽');
      const message=Array.isArray(next)?{role:'assistant',content:null,tool_calls:next.map((t,i)=>({id:`fixture-${step}-${i}`,type:'function',function:{name:t.name,arguments:JSON.stringify(t.args)}}))}:{role:'assistant',content:next.text};
      // Check the real executor returned a response for every preceding tool.
      if(input.messages.at(-1)?.role==='tool'){
        const lastAssistant=input.messages.findLast(m=>m.role==='assistant');
        for(const call of lastAssistant?.tool_calls||[])if(!input.messages.some(m=>m.role==='tool'&&m.tool_call_id===call.id))throw new Error('工具结果未完整返回模型');
      }
      return Response.json({choices:[{message}]});
    }};
    const store=new Store(db,'demo:eval:'+scenario.id);
    const service=new Service(store,{actor:'lin',role:'member',profile:{name:'合成失主'},demo:true,env});
    const holder=new Service(store,{actor:'zhou',role:'member',profile:{name:'合成拾物者'},demo:true,env});
    const context={service,newConversation(){taskId=null;},
      item(extra={}){return holder.createItem({title:'评测合成黑杯',category:'水杯',color:'黑色',description:'仅用于合成执行评测',custody:'合成拾物者保管',privateNote:'合成核实标记，不应出现在候选中',...extra});},
      async chat(text,modelScript){
        script=modelScript;step=0;
        const result=await runChat(service,{text,...(taskId?{taskId}:{})});taskId=result.taskId;
        turns.push({input:text,mode:result.mode,errorCode:result.modelErrorCode,criteria:result.criteria,candidateIds:result.matches.map(m=>m.item.id),execution:result.execution,tools:result.toolExecutions,executorElapsedMs:result.elapsedMs});
        if(result.matches.some(m=>'privateNote' in m.item.body))throw new Error('候选包含非公开特征');
        return result;
      }};
    const started=Date.now();
    try{await scenario.run(context);cases.push({id:scenario.id,label:scenario.label,passed:true,turns,elapsedMs:Date.now()-started});}
    catch(error){cases.push({id:scenario.id,label:scenario.label,passed:false,error:String(error.message).slice(0,600),turns,elapsedMs:Date.now()-started});}
    finally{db.close();}
  }
  const completedTools=new Set(cases.flatMap(c=>c.turns.flatMap(t=>(t.tools||[]).filter(x=>x.status==='completed').map(x=>x.tool))));
  const files=['lib/agent.mjs','lib/model-runtime.mjs','lib/api-pressure.mjs','lib/service.mjs','lib/candidate-feedback.mjs','evals/offline-scenarios.mjs'];
  return {version:JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version,generatedAt:new Date().toISOString(),kind:'scripted-executor-evaluation',fixtureOnly:true,networkRequests:0,realModelInference:false,modelQualityEvaluated:false,disconnectedAccepted:false,
    note:'脚本模型用于验证自研执行器和状态结果，不是基础模型选工具能力或推理速度成绩；耗时仅为合成执行器耗时。',
    summary:{cases:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,completedTools:[...completedTools].sort(),uncoveredTools:AGENT_TOOLS.map(t=>t.function.name).filter(n=>!completedTools.has(n))},
    sourceSha256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),cases};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--output'))throw new Error('仅支持 --output <合成报告路径>；本命令不提供真实模型模式。');
  const report=await evaluateOffline();
  if(args.length)writeFileSync(resolve(args[1]),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({kind:report.kind,realModelInference:false,...report.summary},null,2));
  if(report.summary.failed)process.exitCode=1;
}
