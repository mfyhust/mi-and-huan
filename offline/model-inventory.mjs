import {request,Agent} from 'node:http';
import {resolveModelConfig} from '../lib/model-runtime.mjs';
const agent=new Agent({keepAlive:true});
const allowed=new Set(['/api/version','/api/tags','/api/show','/api/ps']);
export function localMetadata(path,body){
  if(!allowed.has(path))throw new Error('只允许固定的本机模型元数据接口。');
  return new Promise((resolve,reject)=>{
    const payload=body?JSON.stringify(body):null;
    const outgoing=request({hostname:'127.0.0.1',port:11434,path,method:payload?'POST':'GET',agent,headers:payload?{'content-type':'application/json'}:{},signal:AbortSignal.timeout(10000)},incoming=>{
      if(incoming.statusCode!==200){incoming.resume();reject(new Error('本机模型元数据检查未通过。'));return;}
      let text='',bytes=0;
      incoming.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){incoming.destroy();reject(new Error('本机模型元数据过大。'));return;}text+=chunk;});
      incoming.once('error',reject);incoming.once('end',()=>{try{resolve(JSON.parse(text));}catch{reject(new Error('本机模型元数据格式不正确。'));}});
    });
    outgoing.once('error',()=>reject(new Error('本机模型服务尚未就绪。')));outgoing.end(payload);
  });
}
export async function readModelInventory(model){
  resolveModelConfig({XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:model});
  const version=await localMetadata('/api/version'),tags=await localMetadata('/api/tags');
  const record=tags.models?.find(m=>m.name===model||m.model===model);
  if(!record)throw new Error('本机未找到指定权重；不会自动下载或改用其他模型。');
  const shown=await localMetadata('/api/show',{model});
  return {model,digest:record.digest,sizeBytes:record.size,ollamaVersion:version.version,format:shown.details?.format,quantization:shown.details?.quantization_level,parameterSize:shown.details?.parameter_size,capabilities:shown.capabilities||[],modelFamily:shown.details?.family};
}
