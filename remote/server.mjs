import {readFile} from 'node:fs/promises';
import {mkdirSync} from 'node:fs';
import {MAX_UPLOAD_BYTES,normalizePhoto} from './media.mjs';
import {fileBucket,openDatabase} from '../offline/storage.mjs';
import {AccountStore} from './accounts.mjs';
import {authPage} from './auth-page.mjs';
// Remote evaluation gateway. The original localhost-only applications stay unchanged.
import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApiApp,createOfflineApp,ROOT} from '../offline/server.mjs';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
const secureHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const reply=(error,status)=>Response.json({error},{status,headers:secureHeaders});
const digest=s=>createHash('sha256').update(s).digest();
const gate=()=>new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>觅&amp;还 · 参赛体验</title><style>body{max-width:480px;margin:12vh auto;padding:24px;font:18px sans-serif;background:#f5faf8;color:#163b32}input,button{box-sizing:border-box;width:100%;padding:14px;margin:10px 0;font:inherit}button{background:#176d57;color:white;border:0;border-radius:8px}</style><h1>觅&amp;还 · 参赛体验</h1><p>请输入组织者提供的体验口令。</p><form method="post" action="/demo/login"><input type="password" name="code" required maxlength="128" autocomplete="off" placeholder="体验口令"><button>进入独立体验空间</button></form><p>使用合成校园失物数据。请勿填写真实联系方式、证件或其他个人隐私。空间有效期8小时；刷新页面可继续操作。模型繁忙时请稍后重试。</p></html>`,{headers:{...secureHeaders,'content-type':'text/html; charset=utf-8'}});
export function createRemoteDemo({origin,code,edition='local',dataDir=join(ROOT,'.remote-data'),assetsDir,apiConfig={},model='qwen3.5:4b-q4_K_M',accountMode=false,accessScope='loopback',maxSessions=20,sessionMs=8*3600e3,now=Date.now}={}){
 const publicUrl=new URL(origin);
 if(!['loopback','lan'].includes(accessScope))throw new Error('访问范围只能为loopback或lan。');
 const octets=publicUrl.hostname.split('.').map(Number);
 const privateIPv4=/^\d+\.\d+\.\d+\.\d+$/.test(publicUrl.hostname)&&octets.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&(octets[0]===10||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31));

 if(publicUrl.origin!==origin||publicUrl.username||publicUrl.password||!(publicUrl.protocol==='https:'||(publicUrl.protocol==='http:'&&(['127.0.0.1','localhost'].includes(publicUrl.hostname)||(accessScope==='lan'&&privateIPv4)))))throw new Error('演示入口必须为HTTPS源地址；HTTP仅限本机或显式启用的私网IPv4。');
 if(typeof code!=='string'||code.length<(accessScope==='lan'?6:12)||code.length>128)throw new Error('校内体验口令至少6位，其他入口至少12位，最多128位。');
 if(!['api','local'].includes(edition))throw new Error('演示版本只能为api或local。');
 if(!Number.isInteger(maxSessions)||maxSessions<1||maxSessions>100)throw new Error('访客数须为1至100。');
 const sessions=new Map(),opening=new Map();let loginAttempts=[],busy=false,closed=false,authBusy=0;
 let community=null;
 if(accountMode){const dir=join(dataDir,'community',edition);mkdirSync(dir,{recursive:true,mode:0o700});community={db:openDatabase(join(dir,'records.sqlite')),space:'community:'+edition,bucket:fileBucket(join(dir,'media'))};}
 const accounts=accountMode?new AccountStore(join(dataDir,'accounts.sqlite'),{now}):null;
 const editionLinks=accountMode&&publicUrl.protocol==='http:'&&['5183','5184'].includes(publicUrl.port)?Object.fromEntries([['api',5183],['local',5184]].map(([name,port])=>{const u=new URL(origin);u.port=String(port);u.pathname='/auth/login';return [name,u.href];})):null;
 const accountPage=(options={},status=200)=>new Response(authPage({...options,edition,editionLinks}),{status,headers:{...secureHeaders,'content-type':'text/html; charset=utf-8'}});
 const cookieName='migui_demo_'+edition,secure=publicUrl.protocol==='https:'?'; Secure':'';
 const cookie=(token,maxAge=Math.floor(sessionMs/1000))=>cookieName+'='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+maxAge+secure;
 const tokenOf=r=>(r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 async function dispatch(request){
  if(closed)return reply('演示服务已关闭。',503);
  const url=new URL(request.url);
  if(url.origin!==origin||(request.headers.has('host')&&request.headers.get('host')!==publicUrl.host))return reply('演示地址不匹配。',403);
  if((request.headers.get('origin')&&request.headers.get('origin')!==origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply('请求来源不匹配。',403);
  if(!['GET','HEAD','POST'].includes(request.method))return reply('不支持该操作。',405);
  for(const [token,s] of sessions)if(s.expires<=now()&&!s.active){await s.app.close();sessions.delete(token);}
  if(accountMode&&url.pathname.startsWith('/auth/')){
   if(request.method==='GET'&&['/auth/assets/style.css','/auth/assets/form.js'].includes(url.pathname)){
    const css=url.pathname.endsWith('style.css');return new Response(await readFile(new URL(css?'./auth/style.css':'./auth/form.js',import.meta.url)),{headers:{...secureHeaders,'content-type':css?'text/css; charset=utf-8':'text/javascript; charset=utf-8'}});
   }
   if(request.method==='GET'&&['/auth/login','/auth/register'].includes(url.pathname))return accountPage({register:url.pathname.endsWith('register')});
   if(url.pathname==='/auth/logout'&&request.method==='POST'){
    const token=tokenOf(request),current=accounts.authenticate(token,edition),key=current?'account:'+current.id:token;
    accounts.revoke(token,edition);const workspace=sessions.get(key);
    if(workspace&&!workspace.active){await workspace.app.close();sessions.delete(key);}
    return new Response(null,{status:303,headers:{...secureHeaders,location:'/auth/login','set-cookie':cookie('',0)}});
   }
   if(request.method==='POST'&&['/auth/login','/auth/register'].includes(url.pathname)){
    const register=url.pathname.endsWith('register');loginAttempts=loginAttempts.filter(t=>now()-t<60000);
    if(loginAttempts.length>=30||authBusy>=2)return accountPage({register,error:'操作较频繁，请稍后再试。'},429);
    loginAttempts.push(now());const raw=await request.text();if(Buffer.byteLength(raw)>4096)return accountPage({register,error:'表单内容过长。'},413);
    if(authBusy>=2)return accountPage({register,error:'操作较频繁，请稍后再试。'},429);
    const form=new URLSearchParams(raw),input=Object.fromEntries(form);authBusy++;
    try{
     const user=register?await accounts.register(input):await accounts.login(input);
     const session=accounts.issue(user,edition,input.remember==='1');
     return new Response(null,{status:303,headers:{...secureHeaders,location:'/', 'set-cookie':cookie(session.token,session.maxAge)}});
    }catch(error){return accountPage({register,error:error.status?error.message:'账号服务暂时遇到问题，请稍后再试。',username:input.username,nickname:input.nickname},error.status||500);}
    finally{authBusy--;}
   }
   return reply('账号入口不存在或不支持该操作。',404);
  }
  if(accountMode&&url.pathname==='/demo'&&request.method==='GET')return gate();
  if(url.pathname==='/demo/login'&&request.method==='POST'){
   loginAttempts=loginAttempts.filter(t=>now()-t<60000);if(loginAttempts.length>=30)return reply('登录尝试过于频繁，请一分钟后再试。',429);loginAttempts.push(now());
   const raw=await request.text();if(raw.length>1024)return reply('内容过长。',413);
   if(!timingSafeEqual(digest(new URLSearchParams(raw).get('code')||''),digest(code)))return reply('体验口令不正确。',401);
   const existing=sessions.get(tokenOf(request));if(existing)return new Response(null,{status:303,headers:{...secureHeaders,location:'/', 'set-cookie':cookie(tokenOf(request))}});
   if(sessions.size>=maxSessions)return reply('体验空间已满，请联系组织者或稍后再试。',429);
   const token=randomBytes(32).toString('hex');
   const options={dataDir:join(dataDir,edition,randomBytes(16).toString('hex')),assetsDir,apiConfig,model};
   const app=edition==='local'?createOfflineApp(options):createApiApp(options);
   const welcome=await app.dispatch(new Request('http://127.0.0.1/'));
   const internalCookie=welcome.headers.get('set-cookie')?.split(';')[0];
   if(!internalCookie){await app.close();return reply('演示页面尚未构建。',503);}
   sessions.set(token,{app,internalCookie,expires:now()+sessionMs,posts:[],active:0});
   return new Response(null,{status:303,headers:{...secureHeaders,location:'/', 'set-cookie':cookie(token)}});
  }
  const token=tokenOf(request),user=accounts?.authenticate(token,edition);
  let s=sessions.get(user?'account:'+user.id:token);
  if(user&&!s){
   let pending=opening.get(user.id);
   if(!pending){
    if(sessions.size+opening.size>=maxSessions)return reply('当前在线空间已满，请稍后再试。',429);
    pending=(async()=>{
     const options={dataDir:join(dataDir,'registered',edition,user.id),assetsDir,apiConfig,model,community:{...community,user}};
     const app=edition==='local'?createOfflineApp(options):createApiApp(options);
     const welcome=await app.dispatch(new Request('http://127.0.0.1/'));
     const internalCookie=welcome.headers.get('set-cookie')?.split(';')[0];
     if(!internalCookie){await app.close();return null;}
     const workspace={app,internalCookie,expires:now()+sessionMs,posts:[],active:0,user};sessions.set('account:'+user.id,workspace);return workspace;
    })();opening.set(user.id,pending);
   }
   try{s=await pending;}finally{opening.delete(user.id);}
   if(!s)return reply('演示页面尚未构建。',503);
  }
  if(!s)return url.pathname.startsWith('/api/')?reply(accountMode?'请先登录账号，或使用体验口令。':'请先输入体验口令。',401):accountMode?accountPage():gate();
  if(user)s.expires=now()+sessionMs;

  const photoUpload=url.pathname==='/api/media'&&request.method==='POST';
  if(photoUpload&&(!user||request.headers.get('x-demo-mode')!=='0'))return reply('请登录账号并进入校园共享空间后上传照片。',403);
  if(url.pathname==='/api/vision'&&request.method==='POST'&&(!user||request.headers.get('x-demo-mode')!=='0'))return reply('请登录账号并进入校园共享空间后分析自己的照片。',403);
  if(request.method==='POST'){
   s.posts=s.posts.filter(t=>now()-t<600000);if(s.posts.length>=60)return reply('当前空间操作较频繁，请稍后重试。',429);s.posts.push(now());
  }
  const modelCall=request.method==='POST'&&['/api/chat','/api/vision','/api/model/test'].includes(url.pathname);
  if(modelCall&&busy)return reply('模型正在处理另一位体验者的请求，请稍后重试。',429);
  const h=new Headers(request.headers);for(const name of ['host','cookie','origin','sec-fetch-site','content-length','authorization','x-forwarded-host','x-forwarded-proto','x-migui-api-model'])h.delete(name);
  h.set('cookie',s.internalCookie);
  const live=accountMode&&(request.headers.get('x-demo-mode')==='0'||(url.pathname.startsWith('/api/media/')&&url.searchParams.get('mode')==='live'));
  if(live&&!user)return reply('请注册或登录账号后进入校园共享空间。',403);
  h.set('x-demo-mode',live?'0':'1');
  if(live)h.delete('x-demo-actor');
  let body;
  if(request.method==='POST'){
   if(photoUpload){
    if(Number(request.headers.get('content-length')||0)>MAX_UPLOAD_BYTES+65536)return reply('请上传不超过2MB的照片。',413);
    const raw=new Uint8Array(await request.arrayBuffer());if(raw.byteLength>MAX_UPLOAD_BYTES+65536)return reply('请上传不超过2MB的照片。',413);
    try{const form=await new Request('http://127.0.0.1/api/media',{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:raw}).formData();
     const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')return reply('请选择照片文件。',400);if(file.size>MAX_UPLOAD_BYTES)return reply('请上传不超过2MB的照片。',413);
     const bytes=await normalizePhoto(Buffer.from(await file.arrayBuffer()));body=new FormData();body.append('file',new Blob([bytes],{type:'image/jpeg'}),'item.jpg');h.delete('content-type');
    }catch(error){return reply(error.status?error.message:'图片表单无法读取，请重新选择照片。',error.status||400);}
   }else{body=await request.text();if(Buffer.byteLength(body)>180000)return reply('内容过长。',413);}
   if(modelCall){let data;try{data=JSON.parse(body);}catch{return reply('提交内容格式不正确。',400);}if(!data||typeof data!=='object'||Array.isArray(data))return reply('提交内容格式不正确。',400);
    if(edition==='local'&&data.llm?.source!=='rules'){
     try{resolveModelConfig({XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:model},data.llm||{});}
     catch(error){return reply(error.status?error.message:'本地模型配置无效。',error.status||400);}
    }
    if(edition==='api'&&url.pathname!=='/api/vision'&&data.modelChoice){if(![apiConfig.model,...(apiConfig.allowedModels||[])].includes(data.modelChoice))return reply('该模型未获服务端授权。',400);h.set('x-migui-api-model',data.modelChoice);}
    delete data.modelChoice;
    data.llm=data.llm?.source==='rules'?{source:'rules'}:edition==='api'?{source:'server'}:{};
    body=JSON.stringify(data);h.set('content-type','application/json');
   }
  }
  if(modelCall&&busy)return reply('模型正在处理另一位体验者的请求，请稍后重试。',429);
  s.active++;if(modelCall)busy=true;
  try{
   const internal=new URL(url.pathname+url.search,'http://127.0.0.1');
   const res=await s.app.dispatch(new Request(internal,{method:request.method,headers:h,...(body===undefined?{}:{body})}));
   const out=new Headers(res.headers);out.delete('set-cookie');for(const [k,v]of Object.entries(secureHeaders))out.set(k,v);
   if(accountMode&&url.pathname==='/api/bootstrap'&&res.status===200){const data=await res.json();data.accountAccess=true;data.account=user||null;data.communityAccess=!!user;data.editionLinks=editionLinks;data.model.remoteManaged=true;return new Response(JSON.stringify(data),{status:200,headers:out});}
   return new Response(res.body,{status:res.status,headers:out});
  }finally{s.active--;if(modelCall)busy=false;}
 }
 const server=createServer(async(req,res)=>{
  try{
   if(req.headers.host!==publicUrl.host){res.writeHead(403,secureHeaders);res.end('演示地址不匹配。');return;}
   const url=new URL(req.url||'/',origin);if(url.origin!==origin){res.writeHead(403,secureHeaders);res.end();return;}
   const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>((url.pathname==='/api/media'&&req.method==='POST')?MAX_UPLOAD_BYTES+65536:180000)){res.writeHead(413,secureHeaders);res.end('内容过长');return;}chunks.push(c);}
   const response=await dispatch(new Request(url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(500,secureHeaders);res.end('演示服务暂时遇到问题。');}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;
 return {server,dispatch,async close(){closed=true;if(server.listening)await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));await Promise.all([...sessions.values()].map(s=>s.app.close()));sessions.clear();community?.db.close();accounts?.close();}};
}
export async function startRemote(){
 const edition=process.env.MIGUI_DEMO_EDITION||'local',port=Number(process.env.MIGUI_DEMO_PORT||(edition==='api'?5183:5184));
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('演示端口须为1024至65535。');
 if(edition==='local'){for(const k of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete process.env[k];process.env.NODE_USE_ENV_PROXY='0';}
 const accessScope=process.env.MIGUI_DEMO_SCOPE||'loopback';
 const apiConfig=edition==='api'?await import('../api/server.mjs').then(({readApiConfig,apiConfigPath})=>readApiConfig(apiConfigPath(process.env.MIGUI_DEMO_API_CONFIG||process.env.MIGUI_API_CONFIG))):{};
 const app=createRemoteDemo({accountMode:true,accessScope,origin:process.env.MIGUI_DEMO_ORIGIN,code:process.env.MIGUI_DEMO_CODE,edition,apiConfig,assetsDir:join(ROOT,edition==='api'?'dist-api':'dist-offline'),dataDir:process.env.MIGUI_DEMO_DATA_DIR||join(ROOT,'.remote-data')});
 try{await new Promise((ok,fail)=>{app.server.once('error',fail);app.server.listen(port,accessScope==='lan'?'0.0.0.0':'127.0.0.1',ok);});}catch(e){await app.close();throw e;}
 console.log('觅&还远程演示入口已启动，版本：'+edition+'，端口：'+port+'，访问范围：'+accessScope+'。未建立公网隧道。');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
 return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startRemote().catch(()=>{console.error('演示启动失败，请检查源地址、体验口令长度、端口、构建页面和私密配置。');process.exitCode=1;});
