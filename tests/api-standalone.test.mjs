import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApiApp,createOfflineApp} from '../offline/server.mjs';
import {readApiConfig} from '../api/server.mjs';
const fixture=()=>{const dir=mkdtempSync(join(tmpdir(),'migui-api-package-'));const assets=join(dir,'assets');mkdirSync(assets);writeFileSync(join(assets,'index.html'),'<html>synthetic</html>');return {dir,assets};};
const session=async app=>(await app.dispatch(new Request('http://127.0.0.1:5173/'))).headers.get('set-cookie').split(';')[0];
const client=(app,cookie)=>async(path,body)=>{const res=await app.dispatch(new Request('http://127.0.0.1:5173/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}));return {status:res.status,data:await res.json()};};

test('API配置仅允许固定供应商与模型，不接受任意地址，错误不回显密钥',()=>{
 const f=fixture();try{
  assert.equal(readApiConfig().provider,'sjtu');
  for(const cfg of [{provider:'unknown',key:'synthetic-secret'},{provider:'sjtu',url:'https://bad.example',key:'synthetic-secret'},{provider:'sjtu',key:5},null]){
   const file=join(f.dir,'cfg.json');writeFileSync(file,JSON.stringify(cfg));assert.throws(()=>readApiConfig(file),e=>!e.message.includes('synthetic-secret'));
  }
 }finally{rmSync(f.dir,{recursive:true});}
});

test('独立API版本机登录、SQLite、固定基础模型往返与私密配置隔离',async()=>{
 const f=fixture(),old=globalThis.fetch;let calls=0;
 const app=createApiApp({dataDir:join(f.dir,'api-data'),assetsDir:f.assets,apiConfig:{provider:'sjtu',model:'synthetic-model',key:'synthetic-secret'}});
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://models.sjtu.edu.cn/api/v1/chat/completions');assert.equal(options.headers.authorization,'Bearer synthetic-secret');const body=JSON.parse(options.body);assert.equal(body.model,'synthetic-model');return Response.json({choices:[{message:++calls===1?{role:'assistant',content:null,tool_calls:[{id:'search',type:'function',function:{name:'search_found_items',arguments:'{"category":"水杯","color":"黑色"}'}}]}:{role:'assistant',content:'请核对公开候选。'}}]});};
 try{
  assert.equal((await client(app,'invalid')('bootstrap')).status,401);
  const api=client(app,await session(app));await api('demo/init',{});
  const boot=await api('bootstrap');assert.equal(boot.data.model.edition,'api');assert.equal(boot.data.runtime.type,'standalone-api');assert.equal(JSON.stringify(boot).includes('synthetic-secret'),false);
  const turn=await api('chat',{text:'黑色水杯'});assert.equal(turn.data.mode,'model');assert.equal(turn.data.matches.length,2);assert.ok(turn.data.toolExecutions.some(t=>t.tool==='search_found_items'&&t.status==='completed'));
  assert.equal(JSON.stringify(turn.data).includes('synthetic-secret'),false);assert.equal(calls,2);
 }finally{globalThis.fetch=old;await app.close();rmSync(f.dir,{recursive:true});}
});

test('API和离线版独立数据与Cookie，离线工厂拒绝切换API选项',async()=>{
 const f=fixture();const apiApp=createApiApp({dataDir:join(f.dir,'api-data'),assetsDir:f.assets});
 const localApp=createOfflineApp({dataDir:join(f.dir,'local-data'),assetsDir:f.assets,edition:'api',apiConfig:{provider:'sjtu',key:'synthetic-secret'}});
 try{
  const aCookie=await session(apiApp),lCookie=await session(localApp),a=client(apiApp,aCookie),l=client(localApp,lCookie);
  await a('demo/init',{});assert.equal((await a('bootstrap')).data.items.length,9);assert.equal((await l('bootstrap')).data.items.length,0);
  assert.equal((await client(localApp,aCookie)('bootstrap')).status,401);
  const b=await l('bootstrap');assert.equal(b.data.model.edition,'local');assert.equal(b.data.runtime.type,'standalone-offline');assert.equal(JSON.stringify(b).includes('synthetic-secret'),false);
  assert.equal((await l('chat',{text:'不能切到云端',llm:{provider:'sjtu'}})).status,400);
 }finally{await apiApp.close();await localApp.close();rmSync(f.dir,{recursive:true});}
});
