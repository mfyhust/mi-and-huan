import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {checkStoreTransitions} from './store-contract.mjs';

test('本机D1运行时验证批量更新契约（独立临时数据库）',async()=>{
  const runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test");}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],cf:false});
  try{
    const db=await runtime.getD1Database('DB');
    const migration=readFileSync(new URL('../drizzle/0000_military_otto_octavius.sql',import.meta.url),'utf8');
    for(const statement of migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
    await checkStoreTransitions(db);
  }finally{await runtime.dispose();}
});

test('实际Worker和D1通过本机HTTP模拟模型完成两轮工具往返（不是实际开源模型）',async(t)=>{
  let requests=0,stubError;
  const server=createServer(async(req,res)=>{
    try{
      requests++;
      assert.equal(req.url,'/v1/chat/completions');
      assert.equal(req.headers.authorization,undefined);
      let body='';for await(const chunk of req)body+=chunk;
      const input=JSON.parse(body);
      assert.equal(input.model,'qwen3:8b');
      let message;
      if(input.tools?.[0]?.function?.name==='connection_probe'){message={role:'assistant',content:null,tool_calls:[{id:'probe',type:'function',function:{name:'connection_probe',arguments:JSON.stringify({token:input.messages.at(-1).content})}}]};}
      else if(requests===1){
        message={role:'assistant',content:null,tool_calls:[{id:'local-search',type:'function',function:{name:'search_found_items',arguments:'{"category":"水杯","color":"黑色","brand":"本机模拟测试"}'}}]};
      }else{
        assert.equal(input.messages.at(-1).role,'tool');
        assert.equal(JSON.parse(input.messages.at(-1).content).length,2);
        assert.equal(JSON.parse(input.messages.at(-1).content)[0].item.body.locationInfo.places[0].id,'sjtu-mh:dining:5');
        message={role:'assistant',content:'当前有两条候选，请继续核对。'};
      }
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({choices:[{message}],usage:{prompt_tokens:10,completion_tokens:5}}));
    }catch(error){stubError=error;res.writeHead(500);res.end('test assertion failed');}
  });
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(11434,'127.0.0.1',resolve);});
  }catch(error){if(error.code==='EADDRINUSE'){t.skip('11434端口已被占用，不干扰现有推理服务。');return;}throw error;}
  let runtime;
  try{
    const root=fileURLToPath(new URL('../',import.meta.url));
    const main=`import {Store} from './lib/store.mjs';
      import {Service} from './lib/service.mjs';
      import {runChat} from './lib/agent.mjs';
      export default {async fetch(request,env){
        const service=new Service(new Store(env.DB,'demo:transport'),{actor:'lin',role:'member',profile:{name:'test'},demo:true,env});
        if(new URL(request.url).pathname==='/diagnostic')return Response.json(await service.testModel({}));
        const holder=new Service(new Store(env.DB,'demo:transport'),{actor:'holder',role:'member',profile:{name:'holder'},demo:true,env});
        for(const location of ['第四食堂二楼','第五食堂2F'])await holder.createItem({title:'合成测试杯',category:'水杯',color:'黑色',brand:'本机模拟测试',location,description:'本机HTTP模拟用',custody:'本人保管'});
        return Response.json(await runChat(service,{text:'五餐二楼丢了黑色保温杯，品牌本机模拟测试'}));
      }};`;
    const files=['lib/store.mjs','lib/service.mjs','lib/agent.mjs','lib/candidate-feedback.mjs','lib/matching.mjs','lib/seed.mjs','lib/place-learning.mjs','lib/model-runtime.mjs','lib/campus-locations.mjs','data/campus-minhang.mjs'];
    const modules=[{type:'ESModule',path:join(root,'runtime-test.mjs'),contents:main},...files.map(name=>({type:'ESModule',path:join(root,name),contents:readFileSync(join(root,name),'utf8')}))];
    runtime=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{XUNHUI_EDITION:'local',LOCAL_MODEL_NAME:'qwen3:8b',LLM_API_KEY:'external-test-key-must-not-be-sent'},cf:false});
    const db=await runtime.getD1Database('DB');
    for(const statement of readFileSync(new URL('../drizzle/0000_military_otto_octavius.sql',import.meta.url),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
    const response=await runtime.dispatchFetch('http://localhost/test');
    const result=await response.json();
    if(stubError)throw stubError;
    assert.equal(result.mode,'model',result.modelError);
    assert.equal(result.edition,'local');assert.equal(result.provider,'ollama');
    assert.equal(requests,2);assert.equal(result.matches.length,2);
    assert.deepEqual(result.criteria.locationInfo.places[0].floors,[2]);
    assert.equal(result.execution.modelRequests,2);assert.equal(result.execution.toolCalls,1);
    assert.equal(result.toolExecutions[0].tool,'search_found_items');assert.equal(result.toolExecutions[0].status,'completed');
    assert.equal(result.execution.inputTokens,20);assert.equal(result.execution.outputTokens,10);
    const diagnostic=await (await runtime.dispatchFetch('http://localhost/diagnostic')).json();if(stubError)throw stubError;assert.equal(diagnostic.connected,true);assert.equal(diagnostic.toolCalling,true);assert.equal(requests,3);
  }finally{
    if(runtime)await runtime.dispose();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('两种版本在真实Worker/D1中学习并持久保存地点，重建运行时后别名仍能用于登记与匹配',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');
  const root=fileURLToPath(new URL('../',import.meta.url)),dir=mkdtempSync(join(tmpdir(),'xunhui-learning-d1-'));
  const files=['lib/store.mjs','lib/service.mjs','lib/agent.mjs','lib/candidate-feedback.mjs','lib/matching.mjs','lib/seed.mjs','lib/place-learning.mjs','lib/model-runtime.mjs','lib/campus-locations.mjs','data/campus-minhang.mjs'];
  const main=`import {Store} from './lib/store.mjs';import {Service,handleApi} from './lib/service.mjs';
    export default {async fetch(request,env){return handleApi(request,new Service(new Store(env.DB,'demo:persistent-learning'),{actor:'lin',role:'member',profile:{name:'test'},demo:true,env}));}};`;
  const modules=[{type:'ESModule',path:join(root,'runtime-learning-test.mjs'),contents:main},...files.map(name=>({type:'ESModule',path:join(root,name),contents:readFileSync(join(root,name),'utf8')}))];
  let runtime;
  try{
    for(const edition of ['api','local']){
      const options={modules,modulesRoot:root,compatibilityDate:'2026-05-15',d1Databases:['DB'],d1Persist:join(dir,edition),bindings:{XUNHUI_EDITION:edition,LOCAL_MODEL_NAME:'qwen3:8b'},cf:false};
      runtime=new Miniflare(options);const db=await runtime.getD1Database('DB');
      for(const statement of readFileSync(new URL('../drizzle/0000_military_otto_octavius.sql',import.meta.url),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
      const post=async(path,body)=>{const response=await runtime.dispatchFetch('http://localhost/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
      const draft=await post('chat',{text:'记住一个新地点：合成星禾自习室，简称合成星窝，在东中院旁边。'});
      assert.equal(draft.learningProposal.status,'pending');assert.equal(draft.execution.modelRequests,0);
      const pending=await runtime.dispatchFetch('http://localhost/api/places?query='+encodeURIComponent('合成星窝二楼'));assert.equal((await pending.json()).status,'unmapped');
      const learned=await post('chat',{taskId:draft.taskId,text:'确认记住'});assert.equal(learned.learningResult.status,'confirmed');assert.equal(learned.execution.modelRequests,0);
      await runtime.dispose();runtime=new Miniflare(options);
      const lookup=await runtime.dispatchFetch('http://localhost/api/places?query='+encodeURIComponent('合成星窝二楼'));const place=await lookup.json();assert.equal(place.status,'resolved');assert.equal(place.places[0].id,learned.learningResult.placeId);assert.deepEqual(place.places[0].floors,[2]);assert.equal(place.records[0].source.type,'user-confirmed');
      const item=await post('items',{title:'合成测试杯',category:'水杯',color:'黑色',location:'合成星窝2F',description:'合成地点学习测试',custody:'本人保管'});assert.equal(item.item.body.locationInfo.places[0].id,learned.learningResult.placeId);
      const task=await post('tasks',{text:'寻找合成地点的杯子',criteria:{category:'水杯',color:'黑色',location:'合成星禾自习室二楼'}});
      const boot=await (await runtime.dispatchFetch('http://localhost/api/bootstrap')).json();assert.equal(boot.tasks.find(t=>t.id===task.task.id).matches[0].item.id,item.item.id);assert.equal(boot.campus.learnedCount,1);
      await runtime.dispose();runtime=null;
    }
  }finally{if(runtime)await runtime.dispose();rmSync(dir,{recursive:true,force:true});}
});
