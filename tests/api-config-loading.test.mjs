import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {apiConfigPath,readApiConfig} from '../api/server.mjs';
import {importSjtuConfig} from '../api/import-sjtu.mjs';
const secret='synthetic-only-credential',valid='SJTU_BASE_URL=https://models.sjtu.edu.cn/api/v1\nSJTU_API_KEY='+JSON.stringify(secret)+'\n';
test('独立API和校内API共同读取受保护默认配置，显式路径优先且错误不回退',()=>{
 const root=mkdtempSync(join(tmpdir(),'migui-api-config-'));mkdirSync(join(root,'api'));try{
  assert.equal(apiConfigPath(undefined,root),undefined);const target=join(root,'api/config.local.json');writeFileSync(target,JSON.stringify({provider:'sjtu',model:'deepseek-chat',key:secret}));
  assert.equal(apiConfigPath(undefined,root),target);assert.equal(readApiConfig(apiConfigPath(undefined,root)).key,secret);assert.equal(apiConfigPath('/missing/explicit.json',root),'/missing/explicit.json');assert.throws(()=>readApiConfig(apiConfigPath('/missing/explicit.json',root)));
 }finally{rmSync(root,{recursive:true});}
});
test('交大配置导入不输出密钥、限制平台、POSIX写入600且拒绝覆盖',()=>{
 const root=mkdtempSync(join(tmpdir(),'migui-sjtu-import-')),source=join(root,'source.env'),target=join(root,'config.json');try{
  writeFileSync(source,valid);const result=importSjtuConfig({source,target});assert.equal(result.configured,true);assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(readApiConfig(target).key,secret);if(process.platform!=='win32')assert.equal(statSync(target).mode&0o777,0o600);else assert.ok(statSync(target).isFile()); // NTFS ACLs are not POSIX permission bits.
  const before=readFileSync(target,'utf8');assert.throws(()=>importSjtuConfig({source,target}),/未覆盖/);assert.equal(readFileSync(target,'utf8'),before);
 }finally{rmSync(root,{recursive:true});}
});
test('交大导入拒绝地址伪造、重复字段、缺失和非法密钥，错误不回显配置',()=>{
 const root=mkdtempSync(join(tmpdir(),'migui-sjtu-invalid-')),source=join(root,'source.env'),target=join(root,'config.json');try{
  for(const text of [valid.replace('https://models.sjtu.edu.cn/api/v1','https://evil.example/api/v1'),valid+'SJTU_API_KEY=duplicate\n',valid.replace(JSON.stringify(secret),'"bad\\nkey"'),valid.replace(JSON.stringify(secret),'""'),valid+'SJTU_MODEL="broken\n']){
   writeFileSync(source,text);assert.throws(()=>importSjtuConfig({source,target}),e=>!e.message.includes(secret)&&!e.message.includes('evil.example'));assert.throws(()=>statSync(target));
  }
 }finally{rmSync(root,{recursive:true});}
});
test('API可选模型和视觉模型受服务端配置白名单限制',()=>{
 const root=mkdtempSync(join(tmpdir(),'migui-api-models-')),file=join(root,'config.json');try{
  writeFileSync(file,JSON.stringify({provider:'sjtu',model:'deepseek-chat',key:secret,visionModel:'qwen3.8-27b',allowedModels:['deepseek-chat','qwen3.8-27b']}));const c=readApiConfig(file);assert.equal(c.visionModel,'qwen3.8-27b');assert.deepEqual(c.allowedModels,['deepseek-chat','qwen3.8-27b']);
  for(const patch of [{allowedModels:['invalid\nmodel']},{allowedModels:[{key:secret}]},{visionModel:'bad\nmodel'},{allowedModels:Array(9).fill('model')}]){writeFileSync(file,JSON.stringify({provider:'sjtu',model:'deepseek-chat',key:secret,...patch}));assert.throws(()=>readApiConfig(file),e=>!e.message.includes(secret));}
 }finally{rmSync(root,{recursive:true});}
});
test('校内网关只允许配置中的模型，忽略浏览器密钥与内部选择头',async()=>{
 const {createRemoteDemo}=await import('../remote/server.mjs'),root=mkdtempSync(join(tmpdir(),'migui-gateway-model-')),assets=join(root,'assets');mkdirSync(assets);writeFileSync(join(assets,'index.html'),'<html>fixture</html>');
 const origin='https://fixture.example',app=createRemoteDemo({origin,code:'synthetic-demo-code',edition:'api',dataDir:join(root,'data'),assetsDir:assets,apiConfig:{provider:'sjtu',model:'deepseek-chat',key:secret,allowedModels:['deepseek-chat','qwen3.8-27b']}}),old=globalThis.fetch;let calls=0;
 try{
  const login=await app.dispatch(new Request(origin+'/demo/login',{method:'POST',body:'code=synthetic-demo-code'}));const cookie=login.headers.get('set-cookie').split(';')[0];
  const req=(data)=>app.dispatch(new Request(origin+'/api/chat',{method:'POST',headers:{cookie,'content-type':'application/json','x-migui-api-model':'not-allowed'},body:JSON.stringify(data)}));
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://models.sjtu.edu.cn/api/v1/chat/completions');assert.equal(options.headers.authorization,'Bearer '+secret);assert.equal(JSON.parse(options.body).model,'qwen3.8-27b');return Response.json({choices:[{message:{role:'assistant',content:'请核对公开记录。'}}]});};
  assert.equal((await req({text:'水杯',modelChoice:'not-allowed'})).status,400);assert.equal(calls,0);
  const r=await req({text:'黑色水杯',modelChoice:'qwen3.8-27b',llm:{provider:'deepseek',key:'attacker-input',model:'wrong',source:'session'}});assert.equal(r.status,200);const b=await r.json();assert.equal(b.mode,'model');assert.equal(b.model,'qwen3.8-27b');assert.equal(JSON.stringify(b).includes(secret),false);assert.equal(calls,1);
 }finally{globalThis.fetch=old;await app.close();rmSync(root,{recursive:true});}
});
