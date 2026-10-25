// Personal localhost API edition; the Agent and data remain in this application.
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApiApp,ROOT} from '../offline/server.mjs';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
export function apiConfigPath(explicit,root=ROOT){return explicit||(existsSync(join(root,'api','config.local.json'))?join(root,'api','config.local.json'):undefined);}
export function readApiConfig(path){
 if(!path)return {provider:'sjtu',model:'deepseek-chat',key:''};
 const text=readFileSync(path,'utf8');if(text.length>8192)throw new Error('API配置过长。');
 let c;try{c=JSON.parse(text);}catch{throw new Error('API配置不是有效JSON。');}
 if(!c||Array.isArray(c)||typeof c!=='object'||Object.keys(c).some(k=>!['provider','model','key','visionModel','allowedModels'].includes(k))||Object.entries(c).some(([k,v])=>k==='allowedModels'?(!Array.isArray(v)||v.length>8||v.some(m=>typeof m!=='string')):typeof v!=='string'))throw new Error('API配置仅接受provider、model、key、可选visionModel文字字段与allowedModels名称数组，不接受自定义地址。');
 const safe={provider:c.provider||'sjtu',model:c.model||'deepseek-chat',key:c.key||'',...(c.visionModel?{visionModel:c.visionModel}:{}),...(c.allowedModels?{allowedModels:[...new Set([c.model||'deepseek-chat',...c.allowedModels])]}:{})};
 resolveModelConfig({XUNHUI_EDITION:'api',LLM_PROVIDER:safe.provider,LLM_MODEL:safe.model,LLM_API_KEY:safe.key});if(safe.visionModel)resolveModelConfig({XUNHUI_EDITION:'api',LLM_PROVIDER:safe.provider,LLM_MODEL:safe.visionModel,LLM_API_KEY:safe.key});for(const model of safe.allowedModels||[])resolveModelConfig({XUNHUI_EDITION:'api',LLM_PROVIDER:safe.provider,LLM_MODEL:model,LLM_API_KEY:safe.key});return safe;
}
export async function startApi(){
 const configFile=apiConfigPath(process.env.MIGUI_API_CONFIG);
 const config=readApiConfig(configFile),port=Number(process.env.MIGUI_API_PORT||5173);
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('本机端口必须是1024到65535之间的整数。');
 if(!existsSync(join(ROOT,'dist-api','index.html')))throw new Error('API页面尚未构建，请先运行npm run build:api-static。启动不会联网安装。');
 const app=createApiApp({apiConfig:config,dataDir:process.env.MIGUI_API_DATA_DIR||join(ROOT,'.api-data')});
 try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});}catch(e){await app.close();throw e;}
 console.log('觅&还 API 版：http://127.0.0.1:'+port+'；本机个人工作区，模型服务需要网络。');
 console.log(config.key?'已读取私密API配置；连接是否成功以实际调用为准。':'尚未配置API密钥，可在模型设置中填写或使用规则辅助。');
 let closing=false;for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0),()=>process.exit(1));});return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startApi().catch(e=>{console.error(e.code==='EADDRINUSE'?'本机端口被占用，请关闭原服务或更换MIGUI_API_PORT。':e.message);process.exitCode=1;});
