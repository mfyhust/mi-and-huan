import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {database,service} from './helpers.mjs';
import {AccountStore} from '../remote/accounts.mjs';
import {createRemoteDemo} from '../remote/server.mjs';
const password='Synthetic-Only-42',origin='http://192.168.1.10:5184';
const item={title:'合成黑色保温杯',category:'水杯',color:'黑色',description:'银色杯盖',custody:'发布者保管，站内核实',date:'2026-10-26'};
test('发布地点可缺省或留白，模糊图书馆不阻塞发布，其他地点保留原文',async()=>{
 const db=database();try{const s=service(db);for(const location of [undefined,'  ','图书馆','合成未知小径二楼']){
  const r=await s.createItem({...item,location});assert.equal(r.body.locationInfo===null,!location?.trim());if(location?.trim())assert.ok(r.body.location.includes(location));
 }const seeker=service(db,'other');const t=await seeker.newTask({text:'黑色保温杯',criteria:{category:'水杯',color:'黑色'}});assert.ok(t.id);assert.equal((await seeker.candidates(t)).length,4);
 }finally{db.raw.close();}
});
test('留言按用户隔离，管理员可回复并通知，普通用户与跨空间无法越权',async()=>{
 const db=database();try{const a=service(db),b=service(db,'other'),admin=service(db,'volunteer');const ticket=await a.support.create({content:'合成使用问题'});
 assert.equal((await b.support.list()).length,0);assert.equal((await admin.support.list()).length,1);
 await assert.rejects(()=>b.support.reply({id:ticket.id,version:1,content:'冒充回复',role:'admin'}),e=>e.status===403);
 await assert.rejects(()=>service(db,'volunteer','different-space').support.reply({id:ticket.id,version:1,content:'跨空间'}),e=>e.status===404);
 const reply=await admin.support.reply({id:ticket.id,version:1,content:'合成管理员回复'});assert.equal(reply.version,2);assert.equal((await a.support.list())[0].body.replies[0].content,'合成管理员回复');
 assert.ok((await a.store.listOwned('notification','lin')).some(n=>n.body.supportId===ticket.id));
 await assert.rejects(()=>admin.support.reply({id:ticket.id,version:1,content:'重复提交'}),e=>e.status===409);
 for(const content of ['', 'x'.repeat(2001)])await assert.rejects(()=>a.support.create({content}),e=>e.status===400);
 const unrelated=await a.store.add('item','lin',{});await assert.rejects(()=>admin.support.reply({id:unrelated.id,version:1,content:'错误类型'}),e=>e.status===404);
 }finally{db.raw.close();}
});
test('旧账号库补充角色后保留登录和会话，公开注册无法申请管理员',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'migui-admin-migration-')),path=join(dir,'accounts.sqlite');let store=new AccountStore(path);try{
 const user=await store.register({username:'ordinary',password,confirmation:password,role:'admin'});assert.equal(user.role,'member');const session=store.issue(user,'local');store.close();const raw=new DatabaseSync(path);raw.exec('ALTER TABLE accounts DROP COLUMN role');raw.close();store=new AccountStore(path);
 assert.equal((await store.login({username:'ordinary',password})).role,'member');assert.equal(store.authenticate(session.token,'local').id,user.id);
 const admin=await store.createAdmin({username:'admin_test',password,confirmation:password});assert.equal(admin.role,'admin');assert.equal(store.hasAdmin(),true);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
for(const edition of ['api','local'])test(edition+'版真实账号留言、回复、权限与重启持久化（合成，不调用模型）',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'migui-support-http-')),assetsDir=join(dir,'assets'),dataDir=join(dir,'data');mkdirSync(assetsDir);writeFileSync(join(assetsDir,'index.html'),'synthetic');const accounts=new AccountStore(join(dataDir,'accounts.sqlite'));await accounts.createAdmin({username:'admin_test',password,confirmation:password});accounts.close();
 const create=()=>createRemoteDemo({origin,edition,code:'765432',accessScope:'lan',accountMode:true,dataDir,assetsDir});let app=create();
 const call=(path,data,cookie,extra={})=>app.dispatch(new Request(origin+path,{method:data===undefined?'GET':'POST',headers:{cookie:cookie||'','x-demo-mode':'0','content-type':'application/json',...extra},...(data===undefined?{}:{body:JSON.stringify(data)})}));
 const auth=async(path,username)=>{const r=await app.dispatch(new Request(origin+path,{method:'POST',body:new URLSearchParams({username,password,confirmation:password,role:'admin'})}));assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];};
 try{const a=await auth('/auth/register','ordinary'),b=await auth('/auth/register','bystander'),admin=await auth('/auth/login','admin_test');
 const boot=await (await call('/api/bootstrap',undefined,a)).json();assert.equal(boot.profile.role,'member');assert.equal(boot.supportInfo.canReply,false);assert.equal(boot.supportInfo.configured,true);
 assert.equal((await call('/api/items',item,a)).status,200);
 const res=await call('/api/support/tickets',{content:'synthetic-private-message'},a);assert.equal(res.status,200);const {ticket}=await res.json();
 assert.equal((await (await call('/api/bootstrap',undefined,b)).json()).supportTickets.length,0);
 assert.equal((await call('/api/support/reply',{id:ticket.id,version:1,content:'forged'},b,{'x-demo-actor':'volunteer'})).status,403);
 const adminBoot=await (await call('/api/bootstrap',undefined,admin)).json();assert.equal(adminBoot.supportInfo.canReply,true);assert.equal(adminBoot.supportTickets.length,1);
 assert.equal((await call('/api/support/reply',{id:ticket.id,version:1,content:'合成人工回复'},admin)).status,200);
 await app.close();app=create();const persisted=await (await call('/api/bootstrap',undefined,a)).json();assert.equal(persisted.supportTickets[0].body.replies[0].content,'合成人工回复');assert.ok(persisted.notifications.some(n=>n.body.supportId===ticket.id));
 }finally{await app.close();rmSync(dir,{recursive:true});}
});
