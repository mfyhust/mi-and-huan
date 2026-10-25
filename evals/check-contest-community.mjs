// Validate actual extracted application + portable Node + native Sharp. Synthetic data only.
import {spawnSync} from 'node:child_process';import {resolve,join} from 'node:path';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),value=f=>{const n=args.indexOf(f);if(n<0||!args[n+1])throw new Error('缺参数'+f);return resolve(args[n+1]);},output=value('--output');if(existsSync(output))throw new Error('不覆盖已有报告');
const photo=readFileSync(new URL('./fixtures/vision-cup.png',import.meta.url)).toString('base64'),rows=[];
for(const edition of ['api','local']){
 const root=value('--'+edition+'-dir');
 const script=`
import assert from 'node:assert/strict';import {mkdtempSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRemoteDemo} from ${JSON.stringify(pathToFileURL(join(root,'remote/server.mjs')).href)};
assert.equal(existsSync('node_modules'),false);const origin='http://127.0.0.1:5184',dataDir=mkdtempSync(join(tmpdir(),'migui-clean-community-')),app=createRemoteDemo({origin,code:'synthetic-only',edition:${JSON.stringify(edition)},accountMode:true,dataDir,assetsDir:${JSON.stringify(join(root,edition==='api'?'dist-api':'dist-offline'))}}),stages=[];
async function register(username){const r=await app.dispatch(new Request(origin+'/auth/register',{method:'POST',body:new URLSearchParams({username,password:'Only-Synthetic-42',confirmation:'Only-Synthetic-42',nickname:username})}));assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];}
async function call(path,body,cookie,status=200){const r=await app.dispatch(new Request(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'x-demo-mode':'0',...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}));assert.equal(r.status,status,path);return r;}
async function json(path,body,cookie,status=200){return (await call(path,body,cookie,status)).json();}
try{
 const holder=await register('holder'),seeker=await register('seeker'),outsider=await register('outsider');stages.push('解压包账号注册、独立会话');
 const form=new FormData();form.append('file',new Blob([Buffer.from(${JSON.stringify(photo)},'base64')],{type:'image/png'}),'synthetic.png');const media=await json('media',form,holder);
 const privatePhoto=await call('media/'+media.id,undefined,holder);assert.equal(privatePhoto.headers.get('content-type'),'image/jpeg');await call('media/'+media.id,undefined,outsider,403);stages.push('包内Sharp解码重编码JPEG、未发布照片仅本人可见');
 const made=await json('items',{title:'干净包合成绿杯',category:'水杯',color:'绿色',location:'五餐二楼',description:'仅合成图片和物品',custody:'合成保管人暂存',privateNote:'private-synthetic-note',imageId:media.id},holder);
 await call('media/'+media.id,undefined,seeker);const boot=await json('bootstrap',undefined,seeker);assert.equal(JSON.stringify(boot).includes('private-synthetic-note'),false);stages.push('发布后跨账号公开照片、私密特征隔离');
 const chat=await json('chat',{text:'五餐二楼丢了绿色水杯，请查询',llm:{source:'rules'}},seeker);assert.equal(chat.mode,'rules');assert.equal(chat.matches[0].item.id,made.item.id);
 const {claim}=await json('claims',{taskId:chat.taskId,itemId:made.item.id,proof:'合成核实说明'},seeker);await call('claims/action',{id:claim.id,action:'approve'},outsider,403);await json('claims/action',{id:claim.id,action:'approve'},holder);
 const approved=await json('bootstrap',undefined,seeker),code=approved.claims.find(c=>c.id===claim.id).body.pickupCode;await call('claims/action',{id:claim.id,action:'handover',code:code==='000000'?'111111':'000000'},holder,400);await json('claims/action',{id:claim.id,action:'handover',code},holder);await json('claims/action',{id:claim.id,action:'received'},seeker);
 const end=await json('bootstrap',undefined,seeker);assert.equal(end.tasks.find(t=>t.id===chat.taskId).body.status,'found');assert.equal(end.items.find(i=>i.id===made.item.id).body.status,'returned');stages.push('跨账号查询、越权拒绝、错码拒绝、人工交接和确认归还');
 if(${JSON.stringify(edition)}==='local')await call('chat',{text:'禁止云端',llm:{provider:'sjtu'}},seeker,400);
 console.log(JSON.stringify({edition:${JSON.stringify(edition)},passed:true,node:process.versions.node,nodeModulesAtRoot:false,nativePhotoRuntime:true,realModelInference:false,syntheticOnly:true,stages}));
}finally{await app.close();}
`;
 const r=spawnSync(join(root,'.runtime/node'),['--input-type=module','-e',script],{cwd:root,env:{PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:45000});
 if(r.status===0){try{rows.push(JSON.parse(r.stdout.trim().split('\n').at(-1)));}catch{rows.push({edition,passed:false,error:'子检查未返回有效报告'});}}
 else rows.push({edition,passed:false,error:String(r.stderr||r.error||'子检查失败').slice(0,1000)});
}
writeFileSync(output,JSON.stringify({kind:'extracted-portable-node-native-photo-community-check',generatedAt:new Date().toISOString(),results:rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,results:rows}));if(rows.some(r=>!r.passed))process.exitCode=1;
