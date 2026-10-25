import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,cpSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {ROOT} from '../offline/server.mjs';

test('无node_modules的独立目录通过真实本机HTTP运行页面、存储和模拟模型工具往返',async(t)=>{
  assert.ok(existsSync(join(ROOT,'dist-offline','index.html')),'请先运行 npm run build:offline');
  let calls=0,stubError,responseMode='search';
  const stub=createServer(async(req,res)=>{
    try{
      calls++;assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,undefined);
      let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);assert.equal(input.model,'qwen3.5:4b-q4_K_M');assert.equal(body.includes('must-not-forward'),false);
      const message=responseMode==='loop'?{role:'assistant',content:null,tool_calls:[{id:'loop-'+calls,type:'function',function:{name:'get_search_task',arguments:'{}'}}]}:calls===1?{role:'assistant',content:null,tool_calls:[{id:'search',type:'function',function:{name:'search_found_items',arguments:JSON.stringify({category:'水杯',color:'黑色',brand:'模拟离线测试'})}}]}:{role:'assistant',content:'有一条合成候选，请继续核对。'};
      if(calls===2){assert.equal(input.messages.at(-1).role,'tool');assert.equal(JSON.parse(input.messages.at(-1).content).length,1);}
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message}],usage:{prompt_tokens:5,completion_tokens:3}}));
    }catch(error){stubError=error;res.writeHead(500);res.end('mock assertion failed');}
  });
  try{await new Promise((resolve,reject)=>{stub.once('error',reject);stub.listen(11434,'127.0.0.1',resolve);});}catch(error){if(error.code==='EADDRINUSE'){t.skip('本机模型端口正在使用，不干扰现有服务。');return;}throw error;}
  const dir=mkdtempSync(join(tmpdir(),'migui-independent-'));let child;
  try{
    for(const path of ['offline','lib','data','drizzle','dist-offline'])cpSync(join(ROOT,path),join(dir,path),{recursive:true});
    assert.equal(existsSync(join(dir,'node_modules')),false);
    writeFileSync(join(dir,'run-test.mjs'),`import {createOfflineApp} from './offline/server.mjs';const app=createOfflineApp();app.server.listen(0,'127.0.0.1',()=>console.log('PORT='+app.server.address().port));process.once('SIGTERM',()=>app.close().then(()=>process.exit(0)));`);
    child=spawn(process.execPath,[join(dir,'run-test.mjs')],{cwd:dir,env:{...process.env,LLM_API_KEY:'must-not-forward',HTTP_PROXY:'http://127.0.0.1:9',HTTPS_PROXY:'http://127.0.0.1:9',NODE_USE_ENV_PROXY:'1'},stdio:['ignore','pipe','pipe']});
    const lines=createInterface({input:child.stdout});let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
    const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('独立服务启动超时：'+stderr)),15000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('独立服务退出：'+stderr));});lines.on('line',line=>{if(line.startsWith('PORT=')){clearTimeout(timer);resolve(Number(line.slice(5)));}});});
    const base='http://127.0.0.1:'+port;
    const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert.match(html,/本地离线开发版/);assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);const cookie=page.headers.get('set-cookie').split(';')[0];
    for(const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)){const response=await fetch(base+asset[1]);assert.equal(response.status,200);}
    const request=async(path,body,actor='lin')=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json','x-demo-actor':actor},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await r.json();assert.equal(r.status,200,result.error);return result;};
    await request('items',{title:'离线HTTP合成杯',category:'水杯',color:'黑色',brand:'模拟离线测试',location:'五餐二楼',description:'本机独立目录测试',custody:'本人保管'},'zhou');
    const chat=await request('chat',{text:'五餐二楼丢了黑色保温杯，品牌模拟离线测试'});if(stubError)throw stubError;assert.equal(chat.mode,'model',chat.modelError);assert.equal(chat.edition,'local');assert.equal(chat.execution.modelRequests,2);assert.equal(chat.execution.toolCalls,1);assert.equal(chat.matches.length,1);assert.equal(calls,2);
    const boot=await request('bootstrap');assert.equal(boot.tasks.length,1);assert.equal(boot.model.provider,'ollama');assert.equal(JSON.stringify(boot).includes('must-not-forward'),false);
    const denied=await fetch(base+'/api/chat',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({text:'禁止外部服务',llm:{provider:'sjtu'}})});assert.equal(denied.status,400);assert.equal(calls,2);
    responseMode='loop';
    const unfinished=await request('chat',{taskId:chat.taskId,text:'请继续核对当前条件'});
    if(stubError)throw stubError;
    assert.equal(unfinished.mode,'rules-fallback');assert.equal(unfinished.modelErrorCode,'MODEL_ROUND_LIMIT');
    assert.equal(calls,8);assert.equal(unfinished.toolExecutions.length,6);
    const history=await request('chat/history?taskId='+encodeURIComponent(chat.taskId));
    const saved=history.messages.filter(m=>m.role==='assistant').at(-1);
    assert.equal(saved.modelErrorCode,'MODEL_ROUND_LIMIT');assert.deepEqual(saved.toolExecutions,unfinished.toolExecutions);
    const retained=await request('chat',{taskId:chat.taskId,text:'先不要排除这条',llm:{source:'rules'}});assert.equal(retained.matches.length,1);
    const excluded=await request('chat',{taskId:chat.taskId,text:'排除第一条',llm:{source:'rules'}});assert.equal(excluded.matches.length,0);
    const restored=await request('chat',{taskId:chat.taskId,text:'恢复刚才排除的那条',llm:{source:'rules'}});
    assert.equal(restored.matches.length,1);assert.equal(restored.mode,'rules');assert.equal(restored.execution.modelRequests,0);assert.equal(calls,8);
  }finally{
    if(child?.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}
    await new Promise(resolve=>stub.close(resolve));rmSync(dir,{recursive:true,force:true});
  }
});
