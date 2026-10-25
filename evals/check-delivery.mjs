// Fresh extracted packages only, synthetic HTTP rules tests; never calls a model.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {mkdtempSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);if(i<0||!args[i+1])throw new Error('缺少参数'+flag);return resolve(args[i+1]);};
const output=value('--output');if(existsSync(output))throw new Error('不覆盖历史报告');
const reports=[];
for(const edition of ['api','local']){
 const root=value('--'+edition+'-dir');assert.equal(existsSync(join(root,'node_modules')),false);
 const dataDir=mkdtempSync(join(tmpdir(),'migui-delivery-'+edition+'-'));let child,base,cookie;
 const stages=[];
 async function start(){
  const module=pathToFileURL(join(root,'offline/server.mjs')).href;
  const code=`import {${edition==='api'?'createApiApp':'createOfflineApp'} as create} from ${JSON.stringify(module)};const app=create({dataDir:${JSON.stringify(dataDir)}});app.server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:app.server.address().port})));process.once('SIGTERM',()=>app.close().then(()=>process.exit(0)));`;
  child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:root,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH}});
  const lines=createInterface({input:child.stdout});let timer;
  const ready=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('独立包启动超时')),10000);child.once('exit',()=>reject(new Error('独立包提前退出')));child.stderr.on('data',b=>{if(String(b).includes('Error'))reject(new Error(String(b).slice(0,500)));});lines.on('line',line=>{try{resolve(JSON.parse(line));}catch{}});});
  let result;try{result=await ready;}finally{clearTimeout(timer);lines.close();}
  base='http://127.0.0.1:'+result.port;const page=await fetch(base);assert.equal(page.status,200);cookie=page.headers.get('set-cookie').split(';')[0];
  const html=await page.text();for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assert.equal((await fetch(base+match[1])).status,200);
 }
 async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}child=null;}
 async function api(path,body,actor='lin',expected=200){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json','x-demo-actor':actor},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});const result=await r.json();assert.equal(r.status,expected,result.error);return result;}
 try{
  await start();stages.push('无node_modules启动页面、静态资源与本机会话');
  let b=await api('bootstrap');assert.equal(b.model.edition,edition);assert.equal(b.items.length,0);stages.push('干净数据且版本正确');
  await api('demo/init',{});
  const a=await api('chat',{text:'白色象印保温杯',llm:{source:'rules'}});assert.equal(a.mode,'rules');assert.equal(a.matches.length,0);assert.equal(a.searchDiagnostics.status,'criteria_blocked');
  const second=await api('chat',{text:a.searchDiagnostics.suggestions[0].prompt,taskId:a.taskId,llm:{source:'rules'}});assert.equal(second.matches.length,1);assert.equal(second.criteria.clueHints.color.state,'unknown');stages.push('规则HTTP诊断、更正、实际候选');
  const item=second.matches[0].item;await api('feedback',{taskId:a.taskId,itemId:item.id});await api('feedback',{taskId:a.taskId,itemId:item.id,restore:true});
  await api('tasks/action',{id:a.taskId,action:'subscribe'});stages.push('排除恢复及持续留意状态');
  const claim=await api('claims',{taskId:a.taskId,itemId:item.id,proof:'仅合成核实说明，由保管人判断'});
  await api('claims/action',{id:claim.claim.id,action:'approve'},'lin',403);
  await api('claims/action',{id:claim.claim.id,action:'approve'},'zhou');b=await api('bootstrap');const code=b.claims.find(c=>c.id===claim.claim.id).body.pickupCode;
  await api('claims/action',{id:claim.claim.id,action:'handover',code},'zhou');await api('claims/action',{id:claim.claim.id,action:'received'});stages.push('人工核实交接与越权拦截');
  if(edition==='local')await api('chat',{text:'不能切到云端',llm:{provider:'sjtu'}},'lin',400);
  await stop();await start();b=await api('bootstrap');assert.equal(b.tasks.find(t=>t.id===a.taskId).body.status,'found');assert.equal(b.items.find(i=>i.id===item.id).body.status,'returned');stages.push('进程重启恢复最终任务和物品状态');
  reports.push({edition,passed:true,realModelInference:false,nodeModulesPresent:false,stages,sourceHashes:Object.fromEntries(['offline/server.mjs','lib/agent.mjs','lib/service.mjs','dist-'+(edition==='api'?'api':'offline')+'/index.html'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]))});
 }catch(e){reports.push({edition,passed:false,stages,error:e.message});process.exitCode=1;}
 finally{await stop();}
}
writeFileSync(output,JSON.stringify({kind:'fresh-extracted-personal-packages-http-check',node:process.versions.node,realModelInference:false,results:reports},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,results:reports.map(r=>({edition:r.edition,passed:r.passed,stages:r.stages,error:r.error}))},null,2));
