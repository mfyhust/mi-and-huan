// Local-only: copy the user's private SJTU credential to the Worker's ignored env file.
import {existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const source=new URL('.env.sjtu.local',root),target=new URL('.dev.vars',root);
function values(text){const out={};for(const line of text.split(/\r?\n/)){const m=line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);if(!m)continue;let value=m[2];if(value.startsWith('"')){try{value=JSON.parse(value);}catch{throw new Error('私密配置格式不正确，请检查引号。');}}else if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);out[m[1]]=value;}return out;}
if(!existsSync(source))throw new Error('请先在 .env.sjtu.local 填写交大模型配置。');
const cfg=values(readFileSync(source,'utf8'));
if(cfg.SJTU_BASE_URL?.replace(/\/$/,'')!=='https://models.sjtu.edu.cn/api/v1')throw new Error('只允许已授权的交大模型地址。');
if(!cfg.SJTU_API_KEY||/[\r\n\0]/.test(cfg.SJTU_API_KEY))throw new Error('请在本机私密文件中填写有效密钥。');
let old=existsSync(target)?readFileSync(target,'utf8'):'';
old=old.split(/\r?\n/).filter(line=>!/^\s*(?:LLM_PROVIDER|LLM_MODEL|LLM_API_KEY)\s*=/.test(line)).join('\n').trim();
const text=(old?old+'\n':'# 本机私密配置，不提交、不打包。\n')+'LLM_PROVIDER=sjtu\nLLM_MODEL=deepseek-chat\nLLM_API_KEY='+JSON.stringify(cfg.SJTU_API_KEY)+'\n';
writeFileSync(target,text,{mode:0o600});chmodSync(target,0o600);
console.log('已配置本机交大模型 deepseek-chat；密钥未输出。重启开发服务后生效。');
