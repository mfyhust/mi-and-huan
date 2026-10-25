import {request,Agent} from 'node:http';
import {Readable} from 'node:stream';
const endpoint='http://127.0.0.1:11434/v1/chat/completions';
// Explicit agent: do not inherit a process-wide proxy agent or environment proxy.
const agent=new Agent({keepAlive:true});
export function localModelFetch(url,options){
  if(url!==endpoint||options?.method!=='POST'||options.headers?.authorization)throw new Error('本机模型访问策略校验失败。');
  return new Promise((resolve,reject)=>{
    const outgoing=request({hostname:'127.0.0.1',port:11434,path:'/v1/chat/completions',method:'POST',agent,headers:{'content-type':'application/json'},signal:options.signal},incoming=>{
      resolve(new Response(Readable.toWeb(incoming),{status:incoming.statusCode,headers:incoming.headers}));
    });
    outgoing.once('error',reject);outgoing.end(options.body);
  });
}
