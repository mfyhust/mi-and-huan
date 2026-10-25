import assert from 'node:assert/strict';
import {Store} from '../lib/store.mjs';

// Shared contract: run unchanged against SQLite and the actual local D1 binding.
export async function checkStoreTransitions(db){
  const store=new Store(db,'test:'+crypto.randomUUID());
  for(let stale=0;stale<3;stale++){
    const rows=[];
    for(let n=0;n<3;n++)rows.push(await store.add('test','owner',{value:n}));
    await store.save(rows[stale],{value:90+stale});
    await assert.rejects(()=>store.saveMany(rows.map(record=>({record,body:{value:200}}))),{status:409});
    for(let n=0;n<3;n++)assert.equal((await store.get(rows[n].id)).body.value,n===stale?90+n:n,'conflict at position '+stale);
  }
  const a=await store.add('test','owner',{value:1}),b=await store.add('test','owner',{value:2});
  const saved=await store.saveMany([{record:a,body:{value:10}},{record:b,body:{value:20}}]);
  assert.deepEqual(saved.map(r=>r.version),[2,2]);
  assert.equal((await store.get(a.id)).body.value,10);
  assert.equal((await store.get(b.id)).body.value,20);
  assert.deepEqual(await store.saveMany([]),[]);
  await assert.rejects(()=>store.saveMany([{record:saved[0],body:{}},{record:saved[0],body:{}}]),/Duplicate/);
  await assert.rejects(()=>store.saveMany([{record:{...saved[0],space:'other'},body:{}}]),{status:409});
  await store.remove(b.id);
  await assert.rejects(()=>store.saveMany(saved.map(record=>({record,body:{value:300}}))),{status:409});
  assert.equal((await store.get(a.id)).body.value,10);

  // Fail a later SQL statement after an earlier update ran: batch must roll back.
  const originalBatch=db.batch.bind(db);
  const failing={prepare:db.prepare.bind(db),batch(statements){
    const bad=db.prepare("INSERT INTO records (id,space,kind,owner,body,version,created,updated) VALUES (NULL,'x','x','x','{}',1,'','')");
    return originalBatch([statements[0],statements[1],bad,...statements.slice(2)]);
  }};
  await assert.rejects(()=>new Store(failing,store.space).saveMany([{record:saved[0],body:{value:999}}]));
  assert.equal((await store.get(a.id)).body.value,10);
  assert.equal((await store.get(a.id)).version,2);
  const proposal=await store.add('test','owner',{status:'pending'});
  const memory=store.record('memory','owner',{value:'learned'});
  const term=store.record('term','owner',{value:'alias'});
  const [confirmed]=await store.saveMany([{record:proposal,body:{status:'confirmed'}}],[memory,term]);
  assert.equal((await store.get(memory.id)).body.value,'learned');
  const absent=store.record('memory','owner',{});
  await assert.rejects(()=>store.saveMany([{record:proposal,body:{status:'stale'}}],[absent]),{status:409});
  assert.equal(await store.get(absent.id),null);
  // A duplicate unique term must roll back the preceding proposal update AND insert.
  const rolledBack=store.record('memory','owner',{});
  await assert.rejects(()=>store.saveMany([{record:confirmed,body:{status:'bad'}}],[rolledBack,term]));
  assert.equal((await store.get(proposal.id)).body.status,'confirmed');
  assert.equal(await store.get(rolledBack.id),null);
  assert.equal((await store.list('_transition')).length,0,'transient gates must not survive success, conflict or SQL failure');
  await store.clear();
}
