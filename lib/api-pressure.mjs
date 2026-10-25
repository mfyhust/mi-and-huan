// In-process backpressure only; no retries, no provider changes, no saved keys.
export function retryDelay(value,status,now=Date.now()){
 const fallback=status===429?15000:5000;
 if(!value)return fallback;
 const text=String(value).trim();
 const ms=/^\d+(?:\.\d+)?$/.test(text)?Number(text)*1000:Date.parse(text)-now;
 return Number.isFinite(ms)?Math.min(60000,Math.max(1000,ms)):fallback;
}
const denied=(code,message,retryAfterMs)=>Object.assign(new Error(message),{code,retryAfterMs});
export function createApiPressureGuard(clock=Date.now){
 const transports=new WeakMap();
 return (config,transport)=>{
  let scopes=transports.get(transport);if(!scopes){scopes=new Map();transports.set(transport,scopes);}
  const now=clock(),key=config.provider+'\0'+config.key;
  for(const [k,s] of scopes)if(!s.active&&now-s.last>120000&&s.until<=now)scopes.delete(k);
  let state=scopes.get(key);
  if(!state){if(scopes.size>=64)throw denied('MODEL_BUSY','模型连接较多，请稍后再试；任务信息已保留。',5000);state={active:false,until:0,last:now};scopes.set(key,state);}
  state.last=now;
  if(state.until>now){const wait=state.until-now;throw denied('MODEL_COOLDOWN','模型服务正在冷却，请约'+Math.ceil(wait/1000)+'秒后手动重试；不会自动重发。',wait);}
  if(state.active)throw denied('MODEL_BUSY','同一API凭据已有模型请求处理中，请稍后手动重试；本轮不会排队或重复发送。',5000);
  state.active=true;let released=false;
  return {
   failed(error){if(['MODEL_RATE_LIMIT','MODEL_UNAVAILABLE','MODEL_TIMEOUT'].includes(error.code))state.until=clock()+Math.min(60000,Math.max(1000,error.retryAfterMs||5000));},
   release(){if(!released){released=true;state.active=false;state.last=clock();}}
  };
 };
}
export const acquireApiSlot=createApiPressureGuard();
