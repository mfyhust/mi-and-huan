import test from 'node:test';
import assert from 'node:assert/strict';
import {runChat} from '../lib/agent.mjs';
import {database,service} from './helpers.mjs';
const call=(name,args={})=>({role:'assistant',content:null,tool_calls:[{id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]});
test('明确恢复请求提供待完成动作，实际写入后提示消失',async()=>{
 const db=database(),s=service(db);try{
  await s.seed();const first=await runChat(s,{text:'黑色象印水杯'});await runChat(s,{taskId:first.taskId,text:'排除第1条'});
  let n=0;s.ctx.env={XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'fixture',LOCAL_MODEL_FETCH:async(url,options)=>{
   const input=JSON.parse(options.body);let message;
   if(++n===1)message=call('get_search_task');
   else if(n===2){const result=JSON.parse(input.messages.at(-1).content);assert.equal(result.pendingUserAction.arguments.restore,true);assert.equal(result.pendingUserAction.arguments.itemId,first.matches[0].item.id);message=call(result.pendingUserAction.tool,result.pendingUserAction.arguments);}
   else if(n===3)message=call('get_search_task');
   else{assert.equal(JSON.parse(input.messages.at(-1).content).pendingUserAction,null);message={role:'assistant',content:'已恢复，请继续核对。'};}
   return Response.json({choices:[{message}]});
  }};
  const r=await runChat(s,{taskId:first.taskId,text:'刚才排除错了，请恢复那条'});assert.equal(r.mode,'model');assert.equal(r.matches.length,1);assert.ok(r.toolExecutions.some(t=>t.tool==='record_rejection'&&t.status==='completed'));
 }finally{db.raw.close();}
});
