import test from 'node:test';
import assert from 'node:assert/strict';
import {database,service} from './helpers.mjs';
import {runChat} from '../lib/agent.mjs';
import {checkStoreTransitions} from './store-contract.mjs';

test('批量更新在第一、中间、最后一行冲突、记录消失及SQL错误时保持整组一致',async()=>{
  const db=database();try{await checkStoreTransitions(db);}finally{db.raw.close();}
});

for(const mutation of ['record_rejection','update_search_criteria']){
  test('先搜索、后'+mutation+'、再直接回答时，模型工具结果、卡片和历史同步',async()=>{
    const db=database(),s=service(db),original=globalThis.fetch;
    try{
      await s.seed();
      const first=await runChat(s,{text:'黑色保温杯'});
      const rejected=first.matches[0].item.id;
      let requests=0;
      globalThis.fetch=async(url,options)=>{
        const payload=JSON.parse(options.body);
        requests++;
        let message;
        if(requests<3){
          const name=requests===1?'search_found_items':mutation;
          const args=requests===1?{}:mutation==='record_rejection'?{itemId:rejected,reason:'用户确认不是这件'}:{brand:'象印'};
          message={role:'assistant',content:null,tool_calls:[{id:'step-'+requests,type:'function',function:{name,arguments:JSON.stringify(args)}}]};
        }else{
          const result=JSON.parse(payload.messages.at(-1).content);
          assert.equal(result.candidates.length,1,'model must receive refreshed candidates before composing its answer');
          assert.equal(JSON.stringify(result).includes('privateNote'),false);
          message={role:'assistant',content:'目前剩余一条候选，请核对。'};
        }
        return Response.json({choices:[{message}]});
      };
      const result=await runChat(s,{taskId:first.taskId,text:mutation==='record_rejection'?'第一条不是我的，请排除':'我想起来是象印的',llm:{provider:'sjtu',key:'test-only'}});
      assert.equal(result.mode,'model');assert.equal(requests,3);
      assert.equal(result.matches.length,1);
      if(mutation==='record_rejection')assert.equal(result.matches.some(m=>m.item.id===rejected),false);
      else assert.equal(result.criteria.brand,'象印');
      const messages=(await s.store.list('message')).filter(m=>m.body.role==='assistant'&&m.body.taskId===first.taskId);
      assert.ok(messages.some(m=>m.body.content===result.message&&m.body.candidateIds.length===1));
    }finally{globalThis.fetch=original;db.raw.close();}
  });
}
