import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,installationId} from '../offline/storage.mjs';
import {createOfflineApp,readConfig} from '../offline/server.mjs';
import {localModelFetch} from '../offline/local-fetch.mjs';
import {checkStoreTransitions} from './store-contract.mjs';

const fixture=()=>{const dir=mkdtempSync(join(tmpdir(),'migui-offline-')),assets=join(dir,'assets');mkdirSync(assets);writeFileSync(join(assets,'index.html'),'<html>offline fixture</html>');return {dir,assets,data:join(dir,'data')};};
const session=async app=>(await app.dispatch(new Request('http://127.0.0.1:5174/'))).headers.get('set-cookie').split(';')[0];
function client(app,cookie,actor='lin',live=false){return async(path,body)=>{
  const form=body instanceof FormData;
  const request=new Request('http://127.0.0.1:5174/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'x-demo-mode':live?'0':'1','x-demo-actor':actor,...(form?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:form?body:JSON.stringify(body)})});
  const response=await app.dispatch(request);return {status:response.status,body:await response.json()};
};}

test('独立离线SQLite适配器满足原子状态及新增契约，工作区标识重启稳定',async()=>{
  const f=fixture(),db=openDatabase(join(f.dir,'db.sqlite'));try{await checkStoreTransitions(db);assert.equal(installationId(f.data),installationId(f.data));writeFileSync(join(f.data,'installation.json'),'bad');assert.throws(()=>installationId(f.data),/保留数据/);}finally{db.close();rmSync(f.dir,{recursive:true,force:true});}
});

test('离线配置拒绝外部地址/密钥/云模型，本机HTTP传输不接受其他目的地或授权头',()=>{
  const f=fixture();try{
    assert.equal(readConfig().model,'qwen3.5:4b-q4_K_M');
    for(const cfg of [{model:'qwen3.5:4b-q4_K_M',url:'https://example.com'},{model:'qwen3.5:4b-q4_K_M',key:'secret'},{model:'qwen3:4b-cloud'},null,[]]){const path=join(f.dir,'config.json');writeFileSync(path,JSON.stringify(cfg));assert.throws(()=>readConfig(path));}
    assert.throws(()=>localModelFetch('https://example.com',{method:'POST'}),/策略/);assert.throws(()=>localModelFetch('http://127.0.0.1:11434/v1/chat/completions',{method:'POST',headers:{authorization:'secret'}}),/策略/);
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('本机会话、Host/Origin/静态路径边界和资源策略，不信任第三方身份头',async()=>{
  const f=fixture(),app=createOfflineApp({dataDir:f.data,assetsDir:f.assets});try{
    const root=await app.dispatch(new Request('http://127.0.0.1:5174/'));assert.equal(root.status,200);assert.match(root.headers.get('content-security-policy'),/connect-src 'self'/);assert.match(root.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    assert.equal((await app.dispatch(new Request('http://127.0.0.1:5174/api/bootstrap',{headers:{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'fake'}}))).status,401);
    const cookie=root.headers.get('set-cookie').split(';')[0];
    for(const request of [new Request('http://evil.example/api/bootstrap',{headers:{cookie}}),new Request('http://127.0.0.1:5174/api/bootstrap',{headers:{cookie,host:'evil.example'}}),new Request('http://127.0.0.1:5174/api/bootstrap',{headers:{cookie,origin:'https://other.example'}})])assert.equal((await app.dispatch(request)).status,403);
    for(const path of ['/offline/server.mjs','/.offline-data/records.sqlite','/assets/%2e%2e/.offline-data/records.sqlite'])assert.notEqual((await app.dispatch(new Request('http://127.0.0.1:5174'+path))).status,200);
    const c=client(app,cookie),boot=(await c('bootstrap')).body;assert.equal(boot.model.edition,'local');assert.equal(boot.model.provider,'ollama');assert.equal(boot.model.configured,true);assert.equal(JSON.stringify(boot).includes('LOCAL_MODEL_FETCH'),false);
    assert.equal((await c('chat',{text:'不应保存任务',llm:{provider:'sjtu',key:'forbidden'}})).status,400);assert.equal((await c('bootstrap')).body.tasks.length,0);
  }finally{await app.close();rmSync(f.dir,{recursive:true,force:true});}
});

test('离线实际业务闭环：地点学习、图文登记、候选、核实交接与重启恢复',async()=>{
  const f=fixture();let app=createOfflineApp({dataDir:f.data,assetsDir:f.assets});let cookie=await session(app);
  try{
    let lin=client(app,cookie),zhou=client(app,cookie,'zhou');
    const taught=await lin('chat',{text:'记住一个新地点：合成星禾自习室，简称合成星窝。'});assert.equal(taught.status,200);assert.equal(taught.body.learningProposal.status,'pending');
    const learned=await lin('chat',{taskId:taught.body.taskId,text:'确认记住'});assert.equal(learned.body.execution.modelRequests,0);
    const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2foAAAAASUVORK5CYII=','base64'));
    const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'test.png');const uploaded=await zhou('media',form);assert.equal(uploaded.status,200);
    const privateImage=await app.dispatch(new Request('http://127.0.0.1:5174/api/media/'+uploaded.body.id,{headers:{cookie,'x-demo-actor':'lin'}}));assert.equal(privateImage.status,403);
    const published=await zhou('items',{title:'离线合成黑杯',category:'水杯',color:'黑色',location:'合成星窝二楼',description:'合成测试用杯',custody:'本人保管',privateNote:'杯底有演示星号',imageId:uploaded.body.id});assert.equal(published.status,200);
    const image=await app.dispatch(new Request('http://127.0.0.1:5174/api/media/'+uploaded.body.id,{headers:{cookie}}));assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
    const found=await lin('chat',{text:'合成星禾自习室二楼丢了黑色保温杯',llm:{source:'rules'}});assert.equal(found.body.matches[0].item.id,published.body.item.id);assert.equal('privateNote' in found.body.matches[0].item.body,false);
    const claim=await lin('claims',{taskId:found.body.taskId,itemId:published.body.item.id,proof:'杯底有演示星号'});assert.equal(claim.status,200);
    await zhou('claims/action',{id:claim.body.claim.id,action:'approve'});const code=(await lin('bootstrap')).body.claims.find(c=>c.id===claim.body.claim.id).body.pickupCode;assert.ok(code);
    assert.equal((await zhou('claims/action',{id:claim.body.claim.id,action:'handover',code})).status,200);assert.equal((await lin('claims/action',{id:claim.body.claim.id,action:'received'})).status,200);
    const taskId=found.body.taskId;await app.close();app=createOfflineApp({dataDir:f.data,assetsDir:f.assets});
    assert.equal((await app.dispatch(new Request('http://127.0.0.1:5174/api/bootstrap',{headers:{cookie}}))).status,401);cookie=await session(app);lin=client(app,cookie);zhou=client(app,cookie,'zhou');
    const state=(await lin('bootstrap')).body;assert.equal(state.tasks.find(t=>t.id===taskId).body.status,'found');assert.equal(state.items.find(i=>i.id===published.body.item.id).body.status,'returned');assert.equal((await lin('places?query='+encodeURIComponent('合成星窝二楼'))).body.status,'resolved');
    const personal=client(app,cookie,'lin',true);assert.equal((await personal('bootstrap')).body.items.length,0);
    const localForm=new FormData();localForm.append('file',new Blob([png],{type:'image/png'}),'personal.png');const localPhoto=await personal('media',localForm);assert.equal(localPhoto.status,200);
    await personal('items',{title:'本机个人图片测试',category:'其他',location:'五餐',description:'仅本机合成图片',custody:'本人',imageId:localPhoto.body.id});
    const liveImage=await app.dispatch(new Request('http://127.0.0.1:5174/api/media/'+localPhoto.body.id+'?mode=live',{headers:{cookie}}));assert.equal(liveImage.status,200);assert.deepEqual(new Uint8Array(await liveImage.arrayBuffer()),png);
    assert.equal((await lin('bootstrap')).body.items.length,1,'个人图片记录不能混入演示空间');
  }finally{await app.close();rmSync(f.dir,{recursive:true,force:true});}
});
