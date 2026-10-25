import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRemoteDemo} from '../remote/server.mjs';
const origin='https://demo.example',code='synthetic-demo-code';
function setup(extra={}){const dir=mkdtempSync(join(tmpdir(),'migui-remote-'));const assetsDir=join(dir,'assets');mkdirSync(assetsDir);writeFileSync(join(assetsDir,'index.html'),'<html>synthetic</html>');return {dir,app:createRemoteDemo({origin,code,dataDir:join(dir,'records'),assetsDir,...extra})};}
const req=(app,path,body,cookie,headers={})=>app.dispatch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
async function login(app){const r=await req(app,'/demo/login','code='+code);assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];}
test('远程入口口令、指定来源、安全Cookie、会话容量与过期控制',async()=>{let time=0;const {dir,app}=setup({maxSessions:1,sessionMs:1000,now:()=>time});try{
 const gate=await req(app,'/');assert.equal(gate.headers.get('referrer-policy'),'same-origin');assert.match(await gate.text(),/体验口令/);assert.equal((await req(app,'/api/bootstrap')).status,401);
 assert.equal((await req(app,'/demo/login','code=wrong')).status,401);
 assert.equal((await req(app,'/demo/login','code='+code,undefined,{origin:'https://other.example'})).status,403);
 assert.equal((await app.dispatch(new Request('https://wrong.example/'))).status,403);
 const cookie=await login(app);assert.equal((await req(app,'/demo/login','code='+code)).status,429);
 assert.equal((await req(app,'/api/bootstrap',undefined,cookie)).status,200);
 time=1001;assert.equal((await req(app,'/api/bootstrap',undefined,cookie)).status,401);await login(app);
 }finally{await app.close();rmSync(dir,{recursive:true});}});
test('访客数据与演示角色隔离；强制演示空间并禁止照片上传',async()=>{const {dir,app}=setup();try{
 const a=await login(app),b=await login(app);await req(app,'/api/demo/init',{},a);
 const aa=await (await req(app,'/api/bootstrap',undefined,a,{'x-demo-mode':'0'})).json();
 const bb=await (await req(app,'/api/bootstrap',undefined,b)).json();assert.equal(aa.items.length,9);assert.equal(bb.items.length,0);
 assert.equal((await req(app,'/api/media','fake-photo',a)).status,403);
 await req(app,'/api/demo/reset',{},b);assert.equal((await (await req(app,'/api/bootstrap',undefined,a)).json()).items.length,9);
 }finally{await app.close();rmSync(dir,{recursive:true});}});
test('远程API使用服务端固定模型，访客无法覆盖；忙时限流且不泄露密钥',async()=>{const {dir,app}=setup({edition:'api',apiConfig:{provider:'sjtu',model:'fixed-model',key:'synthetic-private-key'}});const old=globalThis.fetch;let release,entered;const enteredPromise=new Promise(ok=>entered=ok);const wait=new Promise(ok=>release=ok);let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://models.sjtu.edu.cn/api/v1/chat/completions');assert.equal(JSON.parse(opts.body).model,'fixed-model');assert.equal(opts.headers.authorization,'Bearer synthetic-private-key');entered();await wait;return Response.json({choices:[{message:{role:'assistant',content:'合成模型响应'}}]});};
 try{const a=await login(app),b=await login(app);const first=req(app,'/api/model/test',{llm:{source:'session',provider:'deepseek',model:'wrong',key:'visitor-key'}},a);await enteredPromise;
 assert.equal((await req(app,'/api/model/test',{},b)).status,429);release();const result=await first;assert.equal(result.status,200);assert.equal(calls,1);assert.equal((await result.text()).includes('synthetic-private-key'),false);
 }finally{release();globalThis.fetch=old;await app.close();rmSync(dir,{recursive:true});}});
test('远程写操作限额且离线入口不接受浏览器云模型切换',async()=>{const {dir,app}=setup();try{const a=await login(app);for(let i=0;i<60;i++)await req(app,'/api/not-existing',{},a);assert.equal((await req(app,'/api/not-existing',{},a)).status,429);
 const b=await login(app);const r=await req(app,'/api/chat',{text:'黑色水杯',llm:{provider:'sjtu',key:'bad',source:'rules'}},b);const data=await r.json();assert.equal(r.status,200);assert.equal(data.mode,'rules');
 for(const llm of [{provider:'sjtu',key:'bad'},{model:'qwen:cloud'},{source:'server'},{url:'https://example.com'}])assert.equal((await req(app,'/api/chat',{text:'不允许覆盖模型',llm},b)).status,400);
 }finally{await app.close();rmSync(dir,{recursive:true});}});

test('校内模式显式开启才允许HTTP私网IP，不放宽原本机模式与公网HTTP',async()=>{
 const f=setup();try{
  assert.throws(()=>createRemoteDemo({origin:'http://192.168.1.10:5184',code}));
  for(const address of ['http://8.8.8.8:5184','http://192.168.999.1:5184','http://example.com'])assert.throws(()=>createRemoteDemo({origin:address,code,accessScope:'lan'}));
  const app=createRemoteDemo({origin:'http://192.168.1.10:5184',code,accessScope:'lan'});
  try{const r=await app.dispatch(new Request('http://192.168.1.10:5184/'));assert.equal(r.status,200);assert.equal((await app.dispatch(new Request('http://192.168.1.11:5184/'))).status,403);}finally{await app.close();}
 }finally{await f.app.close();rmSync(f.dir,{recursive:true});}
});
