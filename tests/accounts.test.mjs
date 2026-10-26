import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../remote/accounts.mjs';
import {createRemoteDemo} from '../remote/server.mjs';
const password='Synthetic-Only-42',origin='http://192.168.1.10:5184';
function fixture(){const dir=mkdtempSync(join(tmpdir(),'migui-accounts-'));const assetsDir=join(dir,'assets');mkdirSync(assetsDir);writeFileSync(join(assetsDir,'index.html'),'<html>synthetic</html>');return {dir,assetsDir};}
const input=username=>({username,nickname:'合成测试同学',password,confirmation:password});
async function call(app,path,data,cookie,extra={}){return app.dispatch(new Request(origin+path,{method:data===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...extra},...(data===undefined?{}:{body:typeof data==='string'?data:new URLSearchParams(data).toString()})}));}
async function register(app,username){const r=await call(app,'/auth/register',input(username));assert.equal(r.status,303,await r.clone().text());return r.headers.get('set-cookie').split(';')[0];}
function create(f){return createRemoteDemo({origin,code:'765432',accessScope:'lan',accountMode:true,dataDir:join(f.dir,'data'),assetsDir:f.assetsDir});}

test('账号密码采用独立盐与scrypt，公开信息和数据库均不含明文密码',async()=>{
 const f=fixture(),db=new AccountStore(join(f.dir,'auth.sqlite'));try{
  const a=await db.register(input('alpha')),b=await db.register(input('beta'));assert.deepEqual(Object.keys(a).sort(),['id','nickname','role','username']);
  const rows=db.db.prepare('SELECT salt,password_hash FROM accounts').all();assert.notEqual(rows[0].salt,rows[1].salt);assert.notEqual(rows[0].password_hash,rows[1].password_hash);assert.equal(rows[0].password_hash.length,128);
  assert.equal((await db.login({username:'ALPHA',password})).id,a.id);await assert.rejects(()=>db.login({username:'alpha',password:'bad'}),/用户名或密码/);await assert.rejects(()=>db.login({username:'missing',password}),/用户名或密码/);
  assert.equal(JSON.stringify(rows).includes(password),false);
 }finally{db.close();rmSync(f.dir,{recursive:true});}
});
test('注册校验重复用户名、确认密码、长度和输入格式；错误不会回显密码',async()=>{
 const f=fixture(),db=new AccountStore(join(f.dir,'auth.sqlite'));try{
  await db.register(input('alpha'));for(const data of [{...input('alpha')},{...input('beta'),confirmation:'different'},{...input('../escape')},{...input('beta'),password:'123',confirmation:'123'},{...input('beta'),nickname:'x'.repeat(25)}])await assert.rejects(()=>db.register(data),e=>e.status===400&&!e.message.includes(password));
 }finally{db.close();rmSync(f.dir,{recursive:true});}
});
test('账号会话只存摘要，区分版本，过期和退出后失效，重启可恢复有效登录',async()=>{
 const f=fixture();let now=100;let db=new AccountStore(join(f.dir,'auth.sqlite'),{now:()=>now});try{
  const user=await db.register(input('alpha')),session=db.issue(user,'local');assert.equal(db.authenticate(session.token,'local').id,user.id);assert.equal(db.authenticate(session.token,'api'),null);
  const row=db.db.prepare('SELECT token_hash FROM account_sessions').get();assert.notEqual(row.token_hash,session.token);db.close();db=new AccountStore(join(f.dir,'auth.sqlite'),{now:()=>now});assert.equal(db.authenticate(session.token,'local').id,user.id);
  now+=8*3600e3+1;assert.equal(db.authenticate(session.token,'local'),null);const remembered=db.issue(user,'local',true);assert.equal(remembered.maxAge,7*86400);db.revoke(remembered.token,'local');assert.equal(db.authenticate(remembered.token,'local'),null);
 }finally{db.close();rmSync(f.dir,{recursive:true});}
});
test('真实注册登录页面可切换、错误保留用户名并转义，未登录无法访问业务',async()=>{
 const f=fixture(),app=create(f);try{
  const page=await call(app,'/');const markup=await page.text();assert.match(markup,/欢迎回来/);assert.match(markup,/觅&amp;还/);assert.match(markup,/http:\/\/192\.168\.1\.10:5183\/auth\/login/);assert.match(await (await call(app,'/auth/register')).text(),/确认密码/);
  assert.equal((await call(app,'/auth/assets/style.css')).status,200);assert.equal((await call(app,'/auth/assets/form.js')).status,200);assert.equal((await call(app,'/api/bootstrap')).status,401);
  const bad=await call(app,'/auth/register',{...input('<script>'),confirmation:'wrong'});const text=await bad.text();assert.equal(bad.status,400);assert.ok(!text.includes(password));assert.ok(!text.includes('value="<script>"'));
  assert.equal((await call(app,'/auth/register',input('crosssite'),null,{origin:'https://evil.example'})).status,403);assert.equal((await call(app,'/auth/logout')).status,404);
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});
test('账号工作区隔离，退出旧Cookie失效，重新登录和服务重启保留数据',async()=>{
 const f=fixture();let app=create(f);try{
  const a=await register(app,'alpha'),b=await register(app,'beta');
  const post=(path,data,cookie)=>call(app,path,JSON.stringify(data),cookie,{'content-type':'application/json'});
  await post('/api/demo/init',{},a);
  let boot=await (await call(app,'/api/bootstrap',undefined,a)).json();assert.equal(boot.account.username,'alpha');assert.equal(boot.model.remoteManaged,true);assert.equal(boot.editionLinks.api,'http://192.168.1.10:5183/auth/login');assert.equal(boot.items.length,9);assert.equal(JSON.stringify(boot).includes(password),false);
  const simultaneous=await Promise.all([call(app,'/api/bootstrap',undefined,b),call(app,'/api/bootstrap',undefined,b)]);assert.ok(simultaneous.every(r=>r.status===200));assert.equal((await simultaneous[0].json()).items.length,0);
  const out=await call(app,'/auth/logout','',a);assert.equal(out.status,303);assert.match(out.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await call(app,'/api/bootstrap',undefined,a)).status,401);
  const login=await call(app,'/auth/login',{username:'alpha',password});assert.equal(login.status,303);const token=login.headers.get('set-cookie').split(';')[0];assert.equal((await (await call(app,'/api/bootstrap',undefined,token)).json()).items.length,9);
  await app.close();app=create(f);boot=await (await call(app,'/api/bootstrap',undefined,token)).json();assert.equal(boot.account.username,'alpha');assert.equal(boot.model.remoteManaged,true);assert.equal(boot.editionLinks.api,'http://192.168.1.10:5183/auth/login');assert.equal(boot.items.length,9);
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});
