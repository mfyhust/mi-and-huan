import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRemoteDemo} from '../remote/server.mjs';
const password='Synthetic-Only-42',origin='http://192.168.1.10:5184';
function fixture(){const dir=mkdtempSync(join(tmpdir(),'migui-community-'));const assetsDir=join(dir,'assets');mkdirSync(assetsDir);writeFileSync(join(assetsDir,'index.html'),'<html>synthetic</html>');return {dir,assetsDir};}
function create(f,edition='local'){return createRemoteDemo({origin,edition,code:'765432',accessScope:'lan',accountMode:true,dataDir:join(f.dir,'data'),assetsDir:f.assetsDir});}
async function call(app,path,data,cookie,extra={}){return app.dispatch(new Request(origin+path,{method:data===undefined?'GET':'POST',headers:{cookie:cookie||'','x-demo-mode':'0','content-type':'application/json',...extra},...(data===undefined?{}:{body:JSON.stringify(data)})}));}
async function register(app,username){const r=await app.dispatch(new Request(origin+'/auth/register',{method:'POST',body:new URLSearchParams({username,password,confirmation:password,nickname:username})}));assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];}
async function json(app,path,data,cookie,extra){const r=await call(app,path,data,cookie,extra);const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
const itemInput={title:'合成黑色保温杯',category:'水杯',color:'黑色',location:'第五餐饮大楼二楼',description:'合成黑色杯，银色杯盖',custody:'发布者暂存，站内核实',privateNote:'synthetic-secret-mark-42',contact:'synthetic-private-contact'};

test('跨账号发布、订阅、规则Agent搜索、核实交接与私密权限闭环',async()=>{
 const f=fixture(),app=create(f);try{
  const a=await register(app,'holder'),b=await register(app,'seeker'),c=await register(app,'bystander');
  const first=await json(app,'/api/bootstrap',undefined,b);assert.equal(first.demo,false);assert.equal(first.runtime.identity,'community');assert.equal(first.profile.role,'member');assert.equal(first.items.length,0);
  const {task}=await json(app,'/api/tasks',{text:'在五餐丢了黑色保温杯',criteria:{category:'水杯',color:'黑色',location:'五餐'}},b);
  await json(app,'/api/tasks/action',{id:task.id,action:'subscribe'},b);
  const {item}=await json(app,'/api/items',itemInput,a);
  const bboot=await json(app,'/api/bootstrap',undefined,b);assert.equal(bboot.items.length,1);assert.equal(bboot.tasks.length,1);assert.equal(bboot.tasks[0].matches[0].item.id,item.id);assert.ok(bboot.notifications.some(n=>n.body.type==='match'));
  const notice=bboot.notifications.find(n=>n.body.type==='match');assert.equal((await call(app,'/api/notifications/read',{id:notice.id},c)).status,403);await json(app,'/api/notifications/read',{id:notice.id},b);assert.equal((await json(app,'/api/bootstrap',undefined,b)).notifications.find(n=>n.id===notice.id).body.read,true);
  assert.equal(JSON.stringify(bboot).includes(itemInput.privateNote),false);assert.equal(JSON.stringify(bboot).includes(itemInput.contact),false);
  const holder=await json(app,'/api/bootstrap',undefined,a);assert.equal(holder.myItems[0].body.privateNote,itemInput.privateNote);assert.equal(holder.tasks.length,0);
  const search=await json(app,'/api/chat',{text:'黑色保温杯',taskId:task.id,llm:{source:'rules'}},b);assert.ok(search.matches.some(m=>m.item.id===item.id));
  assert.equal((await call(app,'/api/chat/history?taskId='+encodeURIComponent(task.id),undefined,a)).status,404);
  const {claim}=await json(app,'/api/claims',{taskId:task.id,itemId:item.id,proof:'synthetic-proof-for-holder-only'},b);
  const bystander=await json(app,'/api/bootstrap',undefined,c,{'x-demo-actor':'volunteer'});assert.equal(bystander.profile.role,'member');assert.equal(bystander.claims.length,0);assert.equal(bystander.tasks.length,0);assert.equal(JSON.stringify(bystander).includes('synthetic-proof-for-holder-only'),false);
  assert.equal((await call(app,'/api/claims/action',{id:claim.id,action:'approve'},c,{'x-demo-actor':'volunteer'})).status,403);
  assert.equal((await call(app,'/api/items/withdraw',{id:item.id},c)).status,403);
  assert.equal((await call(app,'/api/claims/action',{id:claim.id,action:'approve'},b)).status,403);
  await json(app,'/api/claims/action',{id:claim.id,action:'approve'},a);
  const approved=await json(app,'/api/bootstrap',undefined,b),code=approved.claims[0].body.pickupCode;assert.match(code,/^\d{6}$/);
  const holderApproved=await json(app,'/api/bootstrap',undefined,a);assert.equal(holderApproved.claims[0].body.pickupCode,undefined);assert.ok(holderApproved.notifications.some(n=>n.body.type==='claim'));
  const wrong=code==='000000'?'111111':'000000';assert.equal((await call(app,'/api/claims/action',{id:claim.id,action:'handover',code:wrong},a)).status,400);
  await json(app,'/api/claims/action',{id:claim.id,action:'handover',code},a);
  assert.equal((await call(app,'/api/claims/action',{id:claim.id,action:'received'},a)).status,403);
  await json(app,'/api/claims/action',{id:claim.id,action:'received'},b);
  const done=await json(app,'/api/bootstrap',undefined,b);assert.equal(done.tasks[0].body.status,'found');assert.equal(done.items[0].body.status,'returned');assert.equal(done.claims[0].body.status,'completed');
  const ah=await json(app,'/api/bootstrap',undefined,a);assert.ok(ah.notifications.some(n=>n.body.title==='领取人已确认收到'));
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});

test('共享记录持久化、两版与演示隔离，访客不能进入共享或重置共享数据',async()=>{
 const f=fixture();let app=create(f);let api;
 try{
  const a=await register(app,'publisher'),b=await register(app,'reader');const {item}=await json(app,'/api/items',itemInput,a);
  await json(app,'/api/demo/init',{},a,{'x-demo-mode':'1'});assert.equal((await json(app,'/api/bootstrap',undefined,b,{'x-demo-mode':'1'})).items.length,0);
  await json(app,'/api/demo/reset',{},a,{'x-demo-mode':'1'});assert.equal((await json(app,'/api/bootstrap',undefined,b)).items[0].id,item.id);
  assert.equal((await call(app,'/api/demo/reset',{},a)).status,403);
  const guest=await app.dispatch(new Request(origin+'/demo/login',{method:'POST',body:'code=765432'}));const g=guest.headers.get('set-cookie').split(';')[0];assert.equal((await call(app,'/api/bootstrap',undefined,g)).status,403);
  await app.close();app=create(f);assert.equal((await json(app,'/api/bootstrap',undefined,b)).items[0].id,item.id);
  api=create(f,'api');const login=await api.dispatch(new Request(origin+'/auth/login',{method:'POST',body:new URLSearchParams({username:'reader',password})}));assert.equal(login.status,303);const token=login.headers.get('set-cookie').split(';')[0];assert.equal((await json(api,'/api/bootstrap',undefined,token)).items.length,0);
 }finally{await app.close();if(api)await api.close();rmSync(f.dir,{recursive:true});}
});

test('账号地点记忆与对话私有，同名地点可分别确认；撤回和排除反馈不影响他人任务',async()=>{
 const f=fixture(),app=create(f);try{
  const a=await register(app,'alpha'),b=await register(app,'beta');
  const pa=await json(app,'/api/places/propose',{name:'合成星禾小径',aliases:'合成星径',note:'alpha-private-note'},a);
  await json(app,'/api/places/confirm',{id:pa.id,version:pa.version},a);
  const ab=await json(app,'/api/bootstrap',undefined,a),bb=await json(app,'/api/bootstrap',undefined,b);assert.equal(ab.campus.learnedCount,1);assert.equal(bb.campus.learnedCount,0);assert.equal(JSON.stringify(bb).includes('alpha-private-note'),false);
  assert.equal((await call(app,'/api/places/memory/action',{id:ab.placeKnowledge.memories[0].id,version:1,active:false},b)).status,403);
  const pb=await json(app,'/api/places/propose',{name:'合成星禾小径',aliases:'合成星径',note:'beta-private-note'},b);await json(app,'/api/places/confirm',{id:pb.id,version:pb.version},b);
  assert.equal((await json(app,'/api/bootstrap',undefined,b)).campus.learnedCount,1);
  const {item}=await json(app,'/api/items',itemInput,a);
  const {task}=await json(app,'/api/tasks',{text:'黑色保温杯',criteria:{category:'水杯',color:'黑色'}},b);
  await json(app,'/api/feedback',{taskId:task.id,itemId:item.id,reason:'不是我的'},b);
  assert.equal((await json(app,'/api/bootstrap',undefined,b)).tasks[0].matches.length,0);
  assert.equal((await json(app,'/api/bootstrap',undefined,a)).items.length,1);
  await json(app,'/api/items/withdraw',{id:item.id},a);assert.equal((await json(app,'/api/bootstrap',undefined,b)).items[0].body.status,'withdrawn');
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});

test('同一物品多人申请时仅一单可预约，撤销释放后另一申请可继续',async()=>{
 const f=fixture(),app=create(f);try{
  const h=await register(app,'keeper'),a=await register(app,'first'),b=await register(app,'second');
  const {item}=await json(app,'/api/items',itemInput,h);
  const ta=(await json(app,'/api/tasks',{text:'黑色保温杯'},a)).task,tb=(await json(app,'/api/tasks',{text:'黑色保温杯'},b)).task;
  const ca=(await json(app,'/api/claims',{taskId:ta.id,itemId:item.id,proof:'合成特征一'},a)).claim;
  const cb=(await json(app,'/api/claims',{taskId:tb.id,itemId:item.id,proof:'合成特征二'},b)).claim;
  const attempts=await Promise.all([call(app,'/api/claims/action',{id:ca.id,action:'approve'},h),call(app,'/api/claims/action',{id:cb.id,action:'approve'},h)]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  const boot=await json(app,'/api/bootstrap',undefined,h),approved=boot.claims.find(c=>c.body.status==='approved');assert.equal(boot.claims.filter(c=>c.body.status==='approved').length,1);
  const first=approved.id===ca.id;await json(app,'/api/claims/action',{id:approved.id,action:'cancel'},first?a:b);
  assert.equal((await json(app,'/api/bootstrap',undefined,h)).items[0].body.status,'available');
  await json(app,'/api/claims/action',{id:first?cb.id:ca.id,action:'approve'},h);
  assert.equal((await json(app,'/api/bootstrap',undefined,h)).items[0].body.status,'reserved');
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});

test('共享照片上传前私有、发布后跨账号可读，原图元信息移除且撤回后收回访问',async()=>{
 const {default:sharp}=await import('sharp');const f=fixture(),app=create(f);try{
  const a=await register(app,'photoholder'),b=await register(app,'photoseeker');
  const bytes=await sharp({create:{width:1400,height:600,channels:3,background:'#223344'}}).withMetadata({exif:{IFD0:{Artist:'synthetic-private-artist'}}}).png().toBuffer();
  const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'synthetic.png');
  const upload=await app.dispatch(new Request(origin+'/api/media',{method:'POST',headers:{cookie:a,'x-demo-mode':'0'},body:form}));assert.equal(upload.status,200,await upload.clone().text());const {id}=await upload.json();
  const path='/api/media/'+encodeURIComponent(id)+'?mode=live';
  const own=(await json(app,'/api/bootstrap',undefined,a)).myPhotos;assert.ok(own.some(p=>p.id===id));assert.equal('key' in own[0],false);assert.equal((await json(app,'/api/bootstrap',undefined,b)).myPhotos.length,0);
  assert.equal((await call(app,path,undefined,b)).status,403);
  const mine=await call(app,path,undefined,a);assert.equal(mine.status,200);assert.match(mine.headers.get('content-type'),/image\/jpeg/);
  const normalized=Buffer.from(await mine.arrayBuffer()),meta=await sharp(normalized).metadata();assert.equal(meta.width,1000);assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(normalized.includes(Buffer.from('synthetic-private-artist')),false);
  assert.equal((await call(app,'/api/items',{...itemInput,imageId:id},b)).status,400);
  const {item}=await json(app,'/api/items',{...itemInput,imageId:id},a);
  assert.equal((await call(app,path,undefined,b)).status,200);
  assert.equal((await call(app,'/api/items',{...itemInput,imageId:id},a)).status,409);
  assert.equal((await call(app,'/api/vision',{imageId:id},b)).status,403);
  await json(app,'/api/items/withdraw',{id:item.id},a);assert.equal((await call(app,path,undefined,b)).status,403);assert.equal((await call(app,path,undefined,a)).status,200);
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});

test('远程图片拒绝伪造、破损、超限及演示上传，配额按账号独立且重启后仍可读取',async()=>{
 const {default:sharp}=await import('sharp');const f=fixture();let app=create(f);try{
  const a=await register(app,'quotaone'),b=await register(app,'quotatwo');
  async function upload(bytes,cookie=a,mode='0'){
   const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'test.png');return app.dispatch(new Request(origin+'/api/media',{method:'POST',headers:{cookie,'x-demo-mode':mode},body:form}));
  }
  assert.equal((await upload(Buffer.from('<svg onload="alert(1)"></svg>'))).status,400);
  assert.equal((await upload(Buffer.from([137,80,78,71]))).status,400);
  assert.equal((await upload(Buffer.alloc(2*1024*1024+1))).status,413);
  const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#112233'}}).png().toBuffer();
  assert.equal((await upload(bytes,a,'1')).status,403);
  let id;for(let i=0;i<50;i++){const r=await upload(bytes);assert.equal(r.status,200,await r.clone().text());id=(await r.json()).id;}
  assert.equal((await upload(bytes)).status,429);assert.equal((await upload(bytes,b)).status,200);
  await app.close();app=create(f);assert.equal((await call(app,'/api/media/'+encodeURIComponent(id)+'?mode=live',undefined,a)).status,200);
 }finally{await app.close();rmSync(f.dir,{recursive:true});}
});
