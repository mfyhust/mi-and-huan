// Synthetic conversations; ownership and handover are deliberately human actions,
// never model tools. Reports retain stages, not private proofs or pickup codes.
import assert from 'node:assert/strict';
const completed=(r,name)=>r.toolExecutions.some(t=>t.tool===name&&t.status==='completed');
export const journeyCases=[
  {id:'feedback-restore',async run(c){
    const item=await c.item({location:'五餐二楼'});
    const first=await c.chat('我在五餐二楼丢了黑色保温杯，请查询拾获记录');
    assert.equal(first.matches[0]?.item.id,item.id);assert.ok(completed(first,'search_found_items'));
    const rejected=await c.chat('第一条不是我的，请排除第一条');
    assert.ok(completed(rejected,'record_rejection'),'排除必须由模型实际调用工具');
    assert.equal(rejected.matches.some(m=>m.item.id===item.id),false);
    const restored=await c.chat('刚才排除错了，请恢复刚才排除的那条');
    assert.ok(completed(restored,'record_rejection'),'恢复必须由模型实际调用工具');
    assert.equal(restored.matches[0]?.item.id,item.id);
    c.fact('feedbackRestored',true);
  }},
  {id:'cancel-subscription',async run(c){
    const first=await c.chat('五餐丢了黑色保温杯，请查询并订阅持续留意');
    assert.equal(first.subscribed,true);assert.ok(completed(first,'subscribe_to_clues'));
    const cancelled=await c.chat('取消持续留意，之后不要再订阅或新增提醒');
    assert.equal(cancelled.subscribed,false);
    await c.item({location:'五餐二楼'});
    assert.equal((await c.s.store.list('notification')).filter(n=>n.owner==='lin'&&n.body.taskId===first.taskId).length,0);
    c.fact('noNotificationAfterCancellation',true);
  }},
  {id:'human-verified-handover',async run(c){
    const item=await c.item({location:'五餐二楼'});
    const r=await c.chat('五餐二楼丢了黑色保温杯，请查找候选，我会自己提交核实申请');
    assert.equal(r.matches[0]?.item.id,item.id);assert.ok(completed(r,'search_found_items'));
    const claim=await c.s.claim({taskId:r.taskId,itemId:item.id,proof:'合成核实说明，仅由保管人判断'});
    await assert.rejects(()=>c.s.actClaim(claim.id,{action:'approve'}),{status:403});
    await c.holder.actClaim(claim.id,{action:'approve'});
    const code=(await c.s.bootstrap()).claims.find(v=>v.id===claim.id).body.pickupCode;
    await assert.rejects(()=>c.holder.actClaim(claim.id,{action:'handover',code:code==='000000'?'111111':'000000'}),{status:400});
    await c.holder.actClaim(claim.id,{action:'handover',code});
    await c.s.actClaim(claim.id,{action:'received'});
    assert.equal((await c.s.item(item.id)).body.status,'returned');
    const task=await c.s.task(r.taskId);assert.equal(task.body.status,'found');assert.equal(task.body.subscribed,false);
    await assert.rejects(()=>c.s.subscribe(r.taskId),{status:409});
    c.fact('humanStages',['申请','保管人核实','错误领取码被拒绝','保管人交出','申请人确认收到']);
    c.fact('finalTaskStatus',task.body.status);c.fact('finalItemStatus','returned');
  }},
];
