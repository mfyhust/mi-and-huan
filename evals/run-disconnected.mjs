// Explicit Linux process-network isolation. Never changes the host network.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {connect} from 'node:net';
import {mkdtempSync,mkdirSync,readFileSync,readlinkSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createOfflineApp,ROOT} from '../offline/server.mjs';
import {localMetadata,readModelInventory} from '../offline/model-inventory.mjs';
import {MODEL} from './run-local-model.mjs';

const args=process.argv.slice(2),script=fileURLToPath(import.meta.url);
if(!args.length){
  console.log(JSON.stringify({runsModel:false,scope:'仅独立进程网络命名空间，无宿主机网络变更',model:MODEL,syntheticOnly:true,maxWallMs:600000,next:'显式 --run；需要Linux unshare与ip，不安装依赖'},null,2));
}else if(args.length===1&&args[0]==='--run'){
  const child=spawnSync('unshare',['--user','--map-root-user','--net',process.execPath,script,'--inside'],{stdio:'inherit',timeout:600000,env:{...process.env,MIGUI_PARENT_NETNS:readlinkSync('/proc/self/ns/net')}});
  if(child.error)throw child.error;process.exitCode=child.status??1;
}else if(args.length===1&&args[0]==='--inside'){
  const parent=process.env.MIGUI_PARENT_NETNS,current=readlinkSync('/proc/self/ns/net');
  assert.ok(parent&&parent!==current,'必须在不同于宿主机的网络命名空间执行');
  execFileSync('ip',['link','set','lo','up']);
  const interfaces=JSON.parse(execFileSync('ip',['-j','address'],{encoding:'utf8'}));
  assert.deepEqual(interfaces.map(i=>i.ifname),['lo']);
  const routes=JSON.parse(execFileSync('ip',['-j','route'],{encoding:'utf8'}));assert.equal(routes.length,0);
  const externalError=await new Promise((resolve,reject)=>{
    const socket=connect({host:'1.1.1.1',port:443});
    socket.once('connect',()=>{socket.destroy();reject(new Error('隔离失败：外部地址仍可达'));});
    socket.once('error',error=>resolve(error.code));socket.setTimeout(2000,()=>{socket.destroy();reject(new Error('外联应立即因无路由失败，不能以超时代替'));});
  });assert.equal(externalError,'ENETUNREACH');
  const started=Date.now(),dir=mkdtempSync(join(tmpdir(),'migui-disconnected-'));
  const outputs=join(ROOT,'.offline-evaluations');mkdirSync(outputs,{recursive:true,mode:0o700});
  const logPath=join(outputs,'disconnected-ollama-'+Date.now()+'.log'),fd=openSync(logPath,'w',0o600);
  const runner=spawn(process.execPath,[join(ROOT,'offline/start-model.mjs')],{cwd:ROOT,env:process.env,stdio:['ignore',fd,fd]});closeSync(fd);
  const sourceSha256=Object.fromEntries(['offline/server.mjs','offline/storage.mjs','offline/local-fetch.mjs','offline/start-model.mjs','lib/agent.mjs','lib/question-policy.mjs','lib/vision-draft.mjs','lib/appearance-clues.mjs','lib/service.mjs','lib/model-runtime.mjs','lib/api-pressure.mjs','lib/matching.mjs','lib/time-clues.mjs','lib/search-diagnostics.mjs','evals/run-disconnected.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(join(ROOT,p))).digest('hex')]));
  const report={sourceSha256,version:JSON.parse(readFileSync(join(ROOT,'package.json'))).version,generatedAt:new Date().toISOString(),kind:'isolated-network-http-evaluation',fixtureOnly:false,model:MODEL,network:{isolated:true,parent,current,interfaces:interfaces.map(i=>i.ifname),routes,externalAttempt:{address:'1.1.1.1:443',error:externalError}},stages:[],turns:[],passed:false,fullDeliveryAccepted:false};
  let app,base,cookie;
  const stage=name=>report.stages.push(name);
  async function open(){
    app=createOfflineApp({dataDir:dir,assetsDir:join(ROOT,'dist-offline'),model:MODEL});
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
    base='http://127.0.0.1:'+app.server.address().port;
    const page=await fetch(base),html=await page.text();assert.equal(page.status,200);
    cookie=page.headers.get('set-cookie').split(';')[0];
    for(const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assert.equal((await fetch(base+asset[1])).status,200);
  }
  async function api(path,body,actor='lin',expected=200){
    const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json','x-demo-actor':actor},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(150000)});
    const data=await r.json();assert.equal(r.status,expected,data.error);return data;
  }
  async function chat(text,taskId,requiredTools=[]){
    assert.ok(report.turns.length<7,'本次最多七轮真实模型交互，含部件确认与遗忘');
    const r=await api('chat',{text,...taskId?{taskId}:{}});
    report.turns.push({input:text,mode:r.mode,errorCode:r.modelErrorCode,requests:r.execution.modelRequests,tools:r.toolExecutions,reply:r.message});
    assert.equal(r.mode,'model',r.modelError);for(const tool of requiredTools)assert.ok(r.toolExecutions.some(t=>t.tool===tool&&t.status==='completed'),'须实际执行工具：'+tool);return r;
  }
  try{
    let ready=false;
    for(let i=0;i<60;i++){
      if(runner.exitCode!==null)throw new Error('隔离模型服务提前退出，请核对本机日志');
      try{await localMetadata('/api/version');ready=true;break;}catch{await delay(500);}
    }
    assert.ok(ready,'本机模型服务未就绪');assert.equal((await localMetadata('/api/ps')).models.length,0,'须从未加载权重状态开始');
    report.inventory=await readModelInventory(MODEL);stage('断网启动本机模型服务，权重尚未加载');
    await open();stage('冷启动本机页面、静态资源与本机会话');
    const photo=new FormData();photo.append('file',new Blob([readFileSync(join(ROOT,'evals/fixtures/vision-cup.png'))],{type:'image/png'}),'synthetic.png');
    const uploaded=await fetch(base+'/api/media',{method:'POST',headers:{cookie,'x-demo-actor':'lin'},body:photo});assert.equal(uploaded.status,200);const media=await uploaded.json();
    const visual=await api('vision',{imageId:media.id});assert.equal(visual.local,true);assert.equal(visual.needsConfirmation,true);assert.ok(visual.draft.description);
    report.vision={passed:true,model:visual.model,needsConfirmation:visual.needsConfirmation,draft:visual.draft,elapsedMs:visual.elapsedMs,accuracyAssessed:false};stage('断网冷加载真实本机视觉模型，生成待人工确认的外观草稿');
    const first=await chat('五餐二楼丢了黑色保温杯，请查询；如果没有线索，请帮我订阅持续留意',undefined,['search_found_items','subscribe_to_clues']);
    assert.equal(first.subscribed,true);assert.equal(first.matches.length,0);stage('实际模型查询并保存订阅');
    const {item}=await api('items',{title:'断网合成黑色杯',category:'水杯',color:'黑色',location:'五餐二楼',description:'隔离验收合成物品',custody:'合成拾物者本人保管',privateNote:'合成秘密，不得发送给模型'},'zhou');
    let boot=await api('bootstrap');assert.ok(boot.notifications.some(n=>n.body.taskId===first.taskId&&n.body.itemId===item.id));stage('登记晚到线索并收到站内提醒');
    const found=await chat('请重新查询已有拾获记录',first.taskId,['search_found_items']);assert.equal(found.matches[0]?.item.id,item.id);
    assert.equal(JSON.stringify(found.matches).includes('合成秘密'),false);
    const excluded=await chat('第一条不是我的，请排除第一条',first.taskId,['record_rejection']);assert.equal(excluded.matches.length,0);
    const restored=await chat('刚才排除错了，请恢复刚才排除的那条',first.taskId,['record_rejection']);assert.equal(restored.matches[0]?.item.id,item.id);stage('真实模型多轮排除与恢复');
    await app.close();app=null;await open();boot=await api('bootstrap');assert.ok(boot.tasks.some(t=>t.id===first.taskId&&t.body.subscribed));stage('重建应用与数据库连接后恢复任务、订阅和对话');
    assert.ok((await api('chat/history?taskId='+encodeURIComponent(first.taskId))).messages.length>=8);
    const {claim}=await api('claims',{taskId:first.taskId,itemId:item.id,proof:'合成核实凭据，由保管人判断'});
    await api('claims/action',{id:claim.id,action:'approve'},'lin',403);
    await api('claims/action',{id:claim.id,action:'approve'},'zhou');
    boot=await api('bootstrap');const code=boot.claims.find(c=>c.id===claim.id).body.pickupCode;
    await api('claims/action',{id:claim.id,action:'handover',code:code==='000000'?'111111':'000000'},'zhou',400);
    await api('claims/action',{id:claim.id,action:'handover',code},'zhou');
    await api('claims/action',{id:claim.id,action:'received'});boot=await api('bootstrap');
    assert.equal(boot.tasks.find(t=>t.id===first.taskId).body.status,'found');assert.equal(boot.items.find(i=>i.id===item.id).body.status,'returned');stage('人工申请、核实、领取码校验及双方确认完成');
    await api('chat',{text:'请继续找',taskId:first.taskId},'lin',409);
    await api('chat',{text:'不能切换云端',llm:{provider:'sjtu'}},'lin',400);stage('已结束任务及云端覆盖请求被拒绝');
    for(const [title,description] of [['白盖合成杯','黑色杯身，白色杯盖'],['红盖合成杯','黑色杯身，红色杯盖']])await api('items',{title,description,category:'水杯',color:'黑色',brand:'象印',location:'五餐二楼',custody:'断网差异追问合成测试'},'zhou');
    const detail=await chat('五餐二楼丢了黑色象印水杯，请查询',undefined,['search_found_items']);
    assert.equal(detail.clarification?.field,'partColor:杯盖');assert.equal(detail.matches.length,2);
    const confirmed=await chat('杯盖不是红色，是白色，请查询',detail.taskId,['search_found_items']);
    assert.equal(confirmed.criteria.color,'黑色');assert.ok(confirmed.criteria.feature.includes('白色杯盖'));assert.equal(confirmed.matches[0]?.item.body.title,'白盖合成杯');
    const forgotten=await chat('品牌和杯盖颜色都记不清，请继续按现有线索查询',detail.taskId,['search_found_items']);
    assert.equal(forgotten.criteria.brand,'');assert.equal(forgotten.criteria.clueHints.brand.state,'unknown');
    assert.equal(forgotten.criteria.color,'黑色');assert.deepEqual(forgotten.criteria.appearanceUnknownParts,['杯盖']);assert.equal(forgotten.clarification,null);assert.equal(forgotten.matches.length,2);
    assert.equal(forgotten.replyAdjusted,true);assert.ok(forgotten.message.includes('记不清，暂不限定'));assert.equal(forgotten.message.includes('白色杯盖'),false);
    await app.close();app=null;await open();boot=await api('bootstrap');
    assert.deepEqual(boot.tasks.find(t=>t.id===detail.taskId).body.criteria.appearanceUnknownParts,['杯盖']);
    stage('真实模型三轮部件差异追问、确认排序与遗忘，保留主体色，数据库重开保留记不清状态');
    report.passed=true;
  }catch(error){report.error=String(error.message).slice(0,600);process.exitCode=1;}
  finally{
    if(app)await app.close();
    if(runner.exitCode===null){const exited=once(runner,'exit');runner.kill('SIGTERM');await exited;}
    report.elapsedMs=Date.now()-started;report.modelRequests=report.turns.reduce((n,t)=>n+t.requests,0)+(report.vision?.passed?1:0);
    report.note='真实本机模型、隔离网络和实际HTTP核心流程；重建应用实例，不是操作系统重启；包含照片视觉协议与核心闭环；未以合成图评估识物泛化准确率，未验收最终干净双包。保留临时合成数据库供排查，不含用户数据。';
    const path=join(outputs,'disconnected-'+Date.now()+'.json');writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({report:path,passed:report.passed,stages:report.stages,modelRequests:report.modelRequests,elapsedMs:report.elapsedMs,error:report.error},null,2));
  }
}else throw new Error('仅支持默认计划或 --run。');
