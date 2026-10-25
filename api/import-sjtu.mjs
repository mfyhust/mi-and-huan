// Explicit local migration of the user's SJTU configuration. Never log its values.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fail=message=>{throw new Error(message);};
export function importSjtuConfig({source=resolve(ROOT,'.env.sjtu.local'),target=resolve(ROOT,'api/config.local.json')}={}){
 if(existsSync(target))fail('API私密配置已存在，未覆盖；请先核对现有配置。');
 let text;try{text=readFileSync(source,'utf8');}catch{fail('交大私密配置不可读取，请在本机检查文件。');}
 if(text.length>8192)fail('私密配置过长。');
 const values={};
 for(const line of text.split(/\r?\n/)){
  if(!line.trim()||line.trim().startsWith('#'))continue;
  const m=line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);if(!m)fail('私密配置格式不正确，请在本机检查。');
  if(Object.hasOwn(values,m[1]))fail('私密配置存在重复字段，请在本机检查。');
  let v=m[2];if(v.startsWith('"')){try{v=JSON.parse(v);}catch{fail('私密配置引号不正确。');}}else if(v.startsWith("'")){if(!v.endsWith("'"))fail('私密配置引号不正确。');v=v.slice(1,-1);}
  values[m[1]]=v;
 }
 if(values.SJTU_BASE_URL?.replace(/\/$/,'')!=='https://models.sjtu.edu.cn/api/v1')fail('只允许用户指定的交大模型平台。');
 const key=values.SJTU_API_KEY,model=values.SJTU_MODEL||values.SJTU_MODEL_NAME||'deepseek-chat';
 if(typeof key!=='string'||!key.trim()||/[\r\n\0]/.test(key)||key.length>4096)fail('交大密钥缺失或格式不正确。');
 resolveModelConfig({XUNHUI_EDITION:'api',LLM_PROVIDER:'sjtu',LLM_MODEL:model,LLM_API_KEY:key});
 const config={provider:'sjtu',model,key:key.trim()};
 try{writeFileSync(target,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});}catch{fail('API私密配置未写入，请检查路径或是否已存在。');}
 return {provider:config.provider,model:config.model,configured:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const info=importSjtuConfig();console.log(JSON.stringify({...info,message:'已准备独立API版与校内入口的服务端配置；密钥未输出。'}));}catch(error){console.error(error.message);process.exitCode=1;}}
