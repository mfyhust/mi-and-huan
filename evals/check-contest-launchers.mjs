// Executes the documented web launchers from actual extracted packages. No model inference.
import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';import {createServer} from 'node:net';import {mkdtempSync,readlinkSync,writeFileSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {setTimeout as delay} from 'node:timers/promises';
const args=process.argv.slice(2),value=f=>{const i=args.indexOf(f);if(i<0||!args[i+1])throw new Error('缺少参数'+f);return resolve(args[i+1]);},output=value('--output');if(existsSync(output))throw new Error('不覆盖报告');const results=[];
for(const edition of ['api','local']){
 const root=value('--'+edition+'-dir'),reserve=createServer();await new Promise(ok=>reserve.listen(0,'127.0.0.1',ok));const port=reserve.address().port;await new Promise(ok=>reserve.close(ok));
 const script=edition==='api'?'启动API独立版.sh':'启动离线版.sh',dir=mkdtempSync(join(tmpdir(),'migui-launcher-')),prefix=edition==='api'?'MIGUI_API':'MIGUI_OFFLINE';
 assert.equal(existsSync(join(root,'api/config.local.json')),false);const env={PATH:'/usr/bin:/bin',[prefix+'_PORT']:String(port),[prefix+'_DATA_DIR']:dir};let stderr='';
 const child=spawn('bash',[join(root,script)],{cwd:root,env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>stderr+=b.toString().slice(0,500));
 try{
  const until=Date.now()+10000;let response;
  while(Date.now()<until){if(child.exitCode!==null)throw new Error('启动提前结束：'+stderr);try{response=await fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(600)});if(response.ok)break;}catch{}await delay(100);}
  assert.ok(response?.ok,'启动未就绪');assert.equal(readlinkSync('/proc/'+child.pid+'/exe'),join(root,'.runtime/node'));const cookie=response.headers.get('set-cookie').split(';')[0];
  const boot=await(await fetch('http://127.0.0.1:'+port+'/api/bootstrap',{headers:{cookie}})).json();assert.equal(boot.model.edition,edition);
  for(const name of ['启动本机模型.sh','启动校内体验.sh'])if(existsSync(join(root,name)))assert.equal(spawnSync('bash',['-n',join(root,name)]).status,0);
  results.push({edition,passed:true,actualCommand:'bash '+script,portableNodeUsed:true,modelInference:false,configuration:'delivered defaults; no private config',remainingLaunchersSyntaxChecked:true});
 }catch(e){results.push({edition,passed:false,error:String(e.message).slice(0,600)});}
 finally{if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}}
}
writeFileSync(output,JSON.stringify({kind:'documented-launcher-check',generatedAt:new Date().toISOString(),results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(results));if(results.some(r=>!r.passed))process.exitCode=1;
