import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ollamaBinary} from './runtime-path.mjs';
const directory=process.env.MIGUI_MODELS_DIR||fileURLToPath(new URL('../.offline-models',import.meta.url));
mkdirSync(directory,{recursive:true,mode:0o700});
const env={...process.env,OLLAMA_NO_CLOUD:'1',OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:directory,OLLAMA_CONTEXT_LENGTH:'8192',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_KEEP_ALIVE:'2m'};
for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy','OLLAMA_API_KEY','LLM_API_KEY','SJTU_API_KEY','OPENAI_API_KEY','DEEPSEEK_API_KEY','DASHSCOPE_API_KEY','SILICONFLOW_API_KEY','ZHIPU_API_KEY'])delete env[key];
if(process.env.MIGUI_MODEL_CPU==='1'){env.CUDA_VISIBLE_DEVICES='-1';env.ROCR_VISIBLE_DEVICES='-1';env.OLLAMA_VULKAN='0';}
console.log('只启动已安装的Ollama服务；固定本机监听并关闭云功能，不自动下载或加载模型。');
const child=spawn(ollamaBinary(),['serve'],{env,stdio:'inherit'});
child.once('error',()=>{console.error('Ollama未准备好，请先安装运行器并单独导入权重。');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
