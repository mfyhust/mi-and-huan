import {acquireApiSlot,retryDelay} from './api-pressure.mjs';
// Foundation-model transport only. Agent state, tools and permissions live here
// in our application, never in a remote assistant/agent service.
const PROVIDERS={
  sjtu:{url:'https://models.sjtu.edu.cn/api/v1/chat/completions',model:'deepseek-chat'},
  deepseek:{url:'https://api.deepseek.com/chat/completions',model:'deepseek-flash'},
  qwen:{url:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen-plus'},
  zhipu:{url:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-4-flash'},
  siliconflow:{url:'https://api.siliconflow.cn/v1/chat/completions',model:'Qwen/Qwen2.5-72B-Instruct'},
};
const LOCAL_URL='http://127.0.0.1:11434/v1/chat/completions';
// Replaced at build time; an offline build cannot become API-enabled via a POST.
const COMPILED_EDITION=typeof __XUNHUI_EDITION__==='undefined'?null:__XUNHUI_EDITION__;
const fail=(message)=>{throw Object.assign(new Error(message),{status:400});};
const LABELS={sjtu:'上海交大模型平台',deepseek:'DeepSeek',qwen:'通义千问',zhipu:'智谱',siliconflow:'硅基流动',ollama:'本机开源模型'};
const modelName=value=>{if(typeof value!=='string'||!value.trim()||value.length>120||/[\r\n\0]/.test(value))fail('请填写有效的模型名称，最多120个字符。');return value.trim();};
const modelError=(code,message)=>Object.assign(new Error(message),{code});

export function runtimeEdition(env={}){
  const edition=COMPILED_EDITION||env.XUNHUI_EDITION||'api';
  if(!['api','local'].includes(edition))fail('无效运行版本，请使用 API 版或本地离线版启动入口。');
  if(COMPILED_EDITION&&env.XUNHUI_EDITION&&env.XUNHUI_EDITION!==COMPILED_EDITION)fail('构建版本与运行配置不一致，请重新启动对应版本。');
  return edition;
}

function localModel(env){
  const name=String(env.LOCAL_MODEL_NAME||'qwen3:8b');
  if(!/^[a-z0-9][a-z0-9_.:-]{0,119}$/i.test(name)||/cloud/i.test(name))fail('本地版只能配置本机模型名称，不能使用云模型或外部地址。');
  return name;
}

export function modelInfo(env={}){
  const edition=runtimeEdition(env);
  if(edition==='local')return {edition,configured:true,provider:'ollama',model:localModel(env),providers:['ollama'],mode:'model',local:true,availability:'unchecked',vision:{configured:true,model:localModel(env),local:true}};
  const provider=env.LLM_PROVIDER||'qwen';
  return {edition,configured:!!env.LLM_API_KEY,provider,providerLabel:LABELS[provider]||provider,model:env.LLM_MODEL||PROVIDERS[provider]?.model||'',providers:Object.keys(PROVIDERS),providerOptions:Object.entries(PROVIDERS).map(([id,p])=>({id,label:LABELS[id],model:p.model})),mode:env.LLM_API_KEY?'model':'rules',modelOptions:[...new Set([env.LLM_MODEL,...(Array.isArray(env.LLM_ALLOWED_MODELS)?env.LLM_ALLOWED_MODELS:[])].filter(Boolean))],local:false,availability:'unchecked',vision:{configured:!!env.LLM_API_KEY&&!!env.VISION_MODEL_NAME,model:env.VISION_MODEL_NAME||'',provider,local:false}};
}

export function resolveModelConfig(env={},input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('模型配置格式不正确。');
  if(Object.keys(input).some(k=>!['provider','model','key','source'].includes(k)))fail('模型地址只能由服务端确定。');
  for(const k of ['provider','model','key','source'])if(input[k]!==undefined&&typeof input[k]!=='string')fail('模型配置字段必须为文字。');
  if(input.source!==undefined&&!['server','session','rules'].includes(input.source))fail('请选择有效的模型配置来源。');
  const edition=runtimeEdition(env);
  if(edition==='local'){
    if(input.source&&input.source!=='rules')fail('本地版不接受外部模型配置。');
    const model=localModel(env);
    if(input.provider&&input.provider!=='ollama')fail('本地离线版禁止调用外网模型。');
    if(input.key)fail('本地离线版不接受外网模型密钥。');
    if(input.model&&input.model!==model)fail('本地离线版只能使用启动时配置的本机模型。');
    return {edition,provider:'ollama',url:LOCAL_URL,model,key:'',local:true,disabled:input.source==='rules',source:input.source==='rules'?'rules':'local',...(typeof env.LOCAL_MODEL_FETCH==='function'?{request:env.LOCAL_MODEL_FETCH}:{}),turnTimeoutMs:180000};
  }
  if(input.source==='rules')return {edition,provider:null,model:null,key:'',local:false,disabled:true,source:'rules',turnTimeoutMs:90000};
  if(input.source==='server'&&!env.LLM_API_KEY)fail('服务端尚未配置模型，请使用页面配置或规则辅助。');
  if(input.source==='session'&&!input.key?.trim())fail('使用页面配置时需要填写对应服务的 API Key。');
  const useServer=input.source==='server'||(!input.source&&!input.key&&!!env.LLM_API_KEY);
  const provider=useServer?(env.LLM_PROVIDER||'qwen'):(input.provider||env.LLM_PROVIDER||'qwen');
  if(!PROVIDERS[provider])fail('API 版请选择支持的基础模型服务；本机模型请通过本地版入口启动。');
  const key=useServer?env.LLM_API_KEY:(input.key||'');
  if(typeof key!=='string'||key.length>4096||/[\r\n\0]/.test(key))fail('模型密钥格式不正确。');
  return {edition,provider,url:PROVIDERS[provider].url,model:modelName((useServer?env.LLM_MODEL:input.model)||PROVIDERS[provider].model),key:key.trim(),local:false,source:useServer?'server':'session',turnTimeoutMs:90000};
}

export async function completeModel(config,messages,tools,deadline=Date.now()+config.turnTimeoutMs,options={}){
  if(config.local||config.disabled||PROVIDERS[config.provider]?.url!==config.url)return performCompletion(config,messages,tools,deadline,options);
  const transport=fetch,slot=acquireApiSlot(config,transport);
  try{return await performCompletion(config,messages,tools,deadline,options,transport);}
  catch(error){slot.failed(error);throw error;}
  finally{slot.release();}
}
async function performCompletion(config,messages,tools,deadline,options,apiTransport){
  if(config.disabled)throw modelError('MODEL_DISABLED','当前使用规则辅助，没有启用基础模型。');
  if(config.local&&(config.url!==LOCAL_URL||/cloud/i.test(config.model)||config.key))fail('本地模型访问策略校验失败。');
  if(!config.local&&PROVIDERS[config.provider]?.url!==config.url)fail('模型服务地址不符合访问策略。');
  const remaining=deadline-Date.now();
  if(remaining<=0)throw new Error('本轮模型处理已达到时间限制，已保存完成的步骤。');
  const started=Date.now();
  const signal=AbortSignal.timeout(Math.min(remaining,options.timeoutMs|| (config.local?120000:45000)));
  let response;
  try{response=await (config.local&&config.request?config.request:apiTransport||fetch)(config.url,{
    method:'POST',headers:{'content-type':'application/json',...(config.key?{authorization:'Bearer '+config.key}:{})},
    body:JSON.stringify({model:config.model,messages,temperature:0.2,max_tokens:options.maxTokens||768,...(config.local?{reasoning_effort:'none'}:{}),...(tools?{tools,tool_choice:'auto'}:{})}),
    signal,redirect:'manual',
  });}catch{throw modelError(signal.aborted?'MODEL_TIMEOUT':'MODEL_NETWORK',signal.aborted?'模型响应超时，可以稍后重试。':config.local?'本机模型服务连接失败，请确认推理服务已启动。':'无法连接模型服务，请检查网络后重试。');}
  if(response.status>=300&&response.status<400){await response.body?.cancel().catch(()=>{});throw modelError('MODEL_REDIRECT','模型服务重定向已拒绝，请检查本机服务或配置。');}
  if(!response.ok){
    await response.body?.cancel().catch(()=>{});
    const errors={401:['MODEL_AUTH','密钥无效或已失效'],403:['MODEL_FORBIDDEN','账号没有访问该模型的权限'],402:['MODEL_BALANCE','账号额度不足'],404:['MODEL_NOT_FOUND','模型或服务接口不存在'],429:['MODEL_RATE_LIMIT','模型服务繁忙或达到限额，请稍后重试']};
    const [code,hint]=errors[response.status]||[response.status>=500?'MODEL_UNAVAILABLE':'MODEL_REQUEST',response.status>=500?'模型服务暂不可用，请稍后重试':'请求未被接受，请核对模型名称和工具调用支持'];
    const error=modelError(code,'模型服务返回 '+response.status+'：'+hint+'。');
    if(response.status===429||response.status>=500){error.retryAfterMs=retryDelay(response.headers.get('retry-after'),response.status);error.message+='建议等待约'+Math.ceil(error.retryAfterMs/1000)+'秒后手动重试，不会自动重复请求。';}
    throw error;
  }
  let data;
  try{
    if(Number(response.headers.get('content-length'))>2*1024*1024){await response.body?.cancel().catch(()=>{});throw modelError('MODEL_RESPONSE_TOO_LARGE','模型响应过大，已停止读取。');}
    const reader=response.body?.getReader();let size=0;const chunks=[];
    if(!reader)throw modelError('MODEL_PROTOCOL','模型没有返回可读内容。');
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw modelError('MODEL_RESPONSE_TOO_LARGE','模型响应过大，已停止读取。');chunks.push(value);}}
    finally{await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw modelError('MODEL_INVALID_JSON','模型服务未返回有效JSON，请核对接口兼容性。');}
  }catch(error){if(error.code)throw error;throw modelError(signal.aborted?'MODEL_TIMEOUT':'MODEL_NETWORK',signal.aborted?'模型响应超时，可以稍后重试。':'读取模型响应失败，请稍后重试。');}
  const raw=data?.choices?.[0]?.message;
  if(!raw||raw.role!=='assistant'||raw.tool_calls!==undefined&&!Array.isArray(raw.tool_calls))throw modelError('MODEL_PROTOCOL','模型响应格式不受支持。');
  if(data.choices[0].finish_reason==='length')throw modelError('MODEL_TRUNCATED','模型输出被截断，本轮改用规则辅助；请缩短描述或更换模型。');
  const content=Array.isArray(raw.content)?raw.content.filter(p=>p?.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n'):raw.content;
  if(content!==null&&content!==undefined&&typeof content!=='string'||!raw.tool_calls?.length&&!content?.trim())throw modelError('MODEL_PROTOCOL','模型没有返回有效答复或工具调用。');
  const message={role:'assistant',content:content||null,...(raw.tool_calls?.length?{tool_calls:raw.tool_calls}:{}),...(typeof raw.reasoning_content==='string'?{reasoning_content:raw.reasoning_content}:{})};
  const number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
  return {message,usage:{inputTokens:number(data.usage?.prompt_tokens),outputTokens:number(data.usage?.completion_tokens)},elapsedMs:Date.now()-started};
}

// Explicit user action only: use synthetic input, never a real task or candidate.
export async function testModelConnection(env,input={}){
  const cfg=resolveModelConfig(env,input);if(cfg.disabled)fail('规则辅助无需测试模型连接。');
  if(!cfg.key&&!cfg.local)fail('请先填写模型密钥。');
  const started=Date.now(),token='probe-'+crypto.randomUUID();
  const tools=[{type:'function',function:{name:'connection_probe',description:'连通性测试工具。将用户给出的测试标记原样作为token返回。',parameters:{type:'object',properties:{token:{type:'string'}},required:['token'],additionalProperties:false}}}];
  try{
    const result=await completeModel(cfg,[{role:'system',content:'这是基础模型工具接口测试。请调用connection_probe，token必须原样复制用户给出的标记，不要回答普通文本。'},{role:'user',content:token}],tools,started+30000,{timeoutMs:30000,maxTokens:256});
    const call=result.message.tool_calls?.find(c=>c.function?.name==='connection_probe');let supported=false;
    try{const args=JSON.parse(call?.function?.arguments||'{}');supported=!!call?.id&&args.token===token&&Object.keys(args).length===1;}catch{/* Not usable tool arguments. */}
    return {connected:true,toolCalling:supported,provider:cfg.provider,model:cfg.model,edition:cfg.edition,elapsedMs:Date.now()-started,code:supported?'MODEL_READY':'MODEL_TOOLS_UNCONFIRMED',message:supported?'模型已响应，并返回了有效的测试工具调用。':'模型已响应，但没有返回有效的测试工具调用。请检查该模型是否支持工具调用。',usage:result.usage};
  }catch(error){return {connected:false,toolCalling:false,provider:cfg.provider,model:cfg.model,edition:cfg.edition,elapsedMs:Date.now()-started,code:error.code||'MODEL_ERROR',message:error.code?error.message:'模型测试未完成，请核对配置后重试。'};}
}
