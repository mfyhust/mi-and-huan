import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Store} from '../lib/store.mjs';
import {Service,handleApi} from '../lib/service.mjs';
import {DEMO_ACTORS} from '../lib/seed.mjs';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
import {openDatabase,installationId,fileBucket} from './storage.mjs';
import {localModelFetch} from './local-fetch.mjs';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));
const COOKIE='migui_local_session';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
export function configPath(){const local=join(ROOT,'offline','config.json');return process.env.MIGUI_OFFLINE_CONFIG||(existsSync(local)?local:undefined);}
export function readConfig(path){
  if(!path)return {model:'qwen3.5:4b-q4_K_M'};
  const text=readFileSync(path,'utf8');if(text.length>4096)throw new Error('本地模型配置过长。');
  let config;try{config=JSON.parse(text);}catch{throw new Error('本地模型配置不是有效JSON，请保留原文件并修正。');}
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>k!=='model')||typeof config.model!=='string')throw new Error('本地配置仅接受model模型名称，不接受地址或密钥。');
  resolveModelConfig({XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:config.model});return config;
}
export function createOfflineApp(options={}){return createPersonalApp({...options,edition:'local'});}
export function createApiApp(options={}){return createPersonalApp({...options,edition:'api'});}
function createPersonalApp({dataDir,assetsDir,model='qwen3.5:4b-q4_K_M',edition,apiConfig={},community=null,visionPolicy='baseline'}){
  dataDir??=join(ROOT,edition==='local'?'.offline-data':'.api-data');
  assetsDir??=join(ROOT,edition==='local'?'dist-offline':'dist-api');
  const env=edition==='local'?{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:model,LOCAL_MODEL_FETCH:localModelFetch}:{XUNHUI_EDITION:'api',LLM_PROVIDER:apiConfig.provider||'sjtu',LLM_MODEL:apiConfig.model||'deepseek-chat',LLM_API_KEY:apiConfig.key||'',VISION_MODEL_NAME:apiConfig.visionModel||'',LLM_ALLOWED_MODELS:apiConfig.allowedModels||[]};
  if(!['baseline','cautious'].includes(visionPolicy))throw new Error('未知视觉评测策略。');
  env.VISION_DRAFT_POLICY=visionPolicy;
  resolveModelConfig(env);
  const owner=installationId(dataDir),db=openDatabase(join(dataDir,'records.sqlite'));
  env.BUCKET=fileBucket(join(dataDir,'media'));
  const session=randomBytes(32).toString('hex');
  const cookie=()=>COOKIE+'='+session+'; HttpOnly; SameSite=Strict; Path=/';
  const authenticated=request=>{const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';return /^[a-f0-9]{64}$/.test(token)&&timingSafeEqual(Buffer.from(token),Buffer.from(session));};
  async function dispatch(request){
    const url=new URL(request.url),host=request.headers.get('host');
    if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||host&&host!==url.host)return json({error:'仅允许本机地址访问。'},403);
    const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
    if(origin&&origin!==url.origin||site==='cross-site')return json({error:'请求来源不匹配。'},403);
    if(url.pathname.startsWith('/api/')){
      if(!authenticated(request))return json({error:'本机会话尚未建立，请刷新本机页面。',signIn:'/'},401);
      const demo=request.headers.get('x-demo-mode')!=='0'&&!(request.method==='GET'&&url.pathname.startsWith('/api/media/')&&url.searchParams.get('mode')==='live'),key=request.headers.get('x-demo-actor')||'lin';
      const profile=demo?DEMO_ACTORS[key]:community?{name:community.user.nickname,role:'member',initial:community.user.nickname.slice(0,1)}:{name:'本机用户',role:'admin',initial:'本'};
      if(!profile)return json({error:'无效体验角色。'},400);
      const shared=!demo&&community;
      const store=new Store(shared?community.db:db,shared?community.space:(demo?'demo:':'')+(edition==='local'?'offline':edition)+':'+owner);
      const service=new Service(store,{actor:demo?key:community?community.user.id:owner,role:profile.role,profile,demo,env:shared?{...env,BUCKET:community.bucket}:env,runtime:{type:edition==='local'?'standalone-offline':'standalone-api',identity:shared?'community':'personal',offlineAccepted:false}});
      const selectedModel=request.headers.get('x-migui-api-model');
      if(edition==='api'&&selectedModel){if(![apiConfig.model,...(apiConfig.allowedModels||[])].includes(selectedModel))return json({error:'该模型未获服务端授权。'},400);service.ctx.env={...service.ctx.env,LLM_MODEL:selectedModel};}
      const response=await handleApi(request,service);
      for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
      return response;
    }
    if(!['GET','HEAD'].includes(request.method))return json({error:'仅支持本机页面读取。'},405);
    // Local compatibility route; never redirects to an external identity service.
    if(url.pathname==='/signin-with-chatgpt')return new Response(null,{status:303,headers:{...headers,location:'/', 'set-cookie':cookie()}});
    let path;
    try{path=decodeURIComponent(url.pathname);}catch{return json({error:'路径格式不正确。'},400);}
    if(path.includes('\0')||path.includes('\\'))return json({error:'路径格式不正确。'},400);
    const asset=path==='/favicon.svg'||path.startsWith('/assets/');
    if(path!=='/'&&!asset)return json({error:'页面不存在。'},404);
    const target=resolve(assetsDir,asset?'.'+path:'index.html');
    if(!target.startsWith(resolve(assetsDir)+sep))return json({error:'无法读取该路径。'},403);
    try{
      const bytes=await readFile(target),type=target.endsWith('.html')?'text/html; charset=utf-8':target.endsWith('.js')?'text/javascript; charset=utf-8':target.endsWith('.css')?'text/css; charset=utf-8':target.endsWith('.svg')?'image/svg+xml':target.endsWith('.woff2')?'font/woff2':'application/octet-stream';
      return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'content-type':type,...(asset?{}:{'set-cookie':cookie()})}});
    }catch(error){return json({error:error.code==='ENOENT'?'本地页面尚未构建，请先运行 npm run build:offline。':'无法读取本地页面。'},error.code==='ENOENT'?503:500);}
  }
  const server=createServer(async(req,res)=>{
    try{
      const host=req.headers.host||'';if(!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)){res.writeHead(403,headers);res.end('仅允许本机地址');return;}
      const base='http://'+host,url=new URL(req.url||'/',base);if(url.origin!==base){res.writeHead(403,headers);res.end();return;}
      const chunks=[];let size=0;
      if(!['GET','HEAD'].includes(req.method||'GET'))for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024){res.writeHead(413,headers);res.end('内容过长');return;}chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      const response=await dispatch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{if(!res.destroyed&&!res.headersSent){res.writeHead(500,{...headers,'content-type':'application/json'});res.end(JSON.stringify({error:'本机服务暂时遇到问题，请重试。'}));}else res.end();}
  });
  return {server,db,dispatch,async close(){if(server.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));db.close();}};
}
export async function startOffline(){
  // Do not let inherited proxy settings route loopback inference through a proxy.
  for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete process.env[key];
  process.env.NODE_USE_ENV_PROXY='0';
  const config=readConfig(configPath());
  const port=Number(process.env.MIGUI_OFFLINE_PORT||5174);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('本机端口必须是1024到65535之间的整数。');
  const assetsDir=join(ROOT,'dist-offline');if(!existsSync(join(assetsDir,'index.html')))throw new Error('离线页面尚未构建，请先运行 npm run build:offline；启动不会自动联网安装。');
  const app=createOfflineApp({model:config.model,dataDir:process.env.MIGUI_OFFLINE_DATA_DIR||join(ROOT,'.offline-data'),assetsDir});
  try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});}catch(error){await app.close();throw error;}
  console.log('觅&还本地离线开发版：http://127.0.0.1:'+port+'；本机个人工作区，不依赖云登录。');
  console.log('模型：'+config.model+'；未自动启动、下载或测试模型。实际推理与断网验收尚待完成。');
  let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0),()=>process.exit(1));});
  return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startOffline().catch(error=>{console.error(error.code==='EADDRINUSE'?'本机端口已被占用，请停止原服务或更换MIGUI_OFFLINE_PORT。':error.message);process.exitCode=1;});
