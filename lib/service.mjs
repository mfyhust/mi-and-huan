import {diagnoseSearch} from './search-diagnostics.mjs';
import {sanitizeDateRange} from './time-clues.mjs';
import {sanitizeUnknownParts} from './appearance-clues.mjs';
import {rank, publicItem, CATEGORIES, LOCATIONS, sanitizeClueHints} from './matching.mjs';
import {DEMO_ACTORS, seedItems} from './seed.mjs';
import {runChat, visionDescription, modelInfo} from './agent.mjs';
import {CAMPUS,CAMPUS_PLACES,resolveCampusLocation,lookupCampusPlace,refreshLocation} from './campus-locations.mjs';
import {PlaceMemory,detectPlaceTeaching} from './place-learning.mjs';
import {resolveModelConfig,testModelConnection} from './model-runtime.mjs';

export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const required=(v,label,max)=>{const s=clean(v,max);if(!s)fail('请填写'+label+'。');return s;};
const uid=()=>crypto.randomUUID();
const legalCriteria=['category','color','brand','location','date','feature','uncertain','imageHash'];
export function criteriaFrom(v={},prior={},catalog=CAMPUS_PLACES){
  const out={};for(const k of legalCriteria)if(v[k]!==undefined)out[k]=k==='uncertain'?!!v[k]:clean(v[k],k==='location'?240:100);
  if('dateRange' in v)out.dateRange=sanitizeDateRange(v.dateRange);
  else if('date' in out&&out.date!==prior.date)out.dateRange=null;
  if('dateUnknown' in v)out.dateUnknown=v.dateUnknown===true;
  else if(out.date)out.dateUnknown=false;
  if('clueHints' in v)out.clueHints=sanitizeClueHints(v.clueHints);
  else for(const key of ['category','color','brand'])if(key in out&&out[key]!==prior[key]&&prior.clueHints?.[key]){out.clueHints??=sanitizeClueHints(prior.clueHints);delete out.clueHints[key];}
  if('appearanceUnknownParts' in v)out.appearanceUnknownParts=sanitizeUnknownParts(v.appearanceUnknownParts);
  if('location' in out){
    if(!out.location)out.locationInfo=null;
    else{const before=prior.location?refreshLocation(prior.location,prior.locationInfo,catalog):null;out.locationInfo=resolveCampusLocation(out.location,before,catalog);out.location=out.locationInfo.label;}
  }
  return out;
}

export class Service {
  constructor(store,ctx){this.store=store;this.ctx=ctx;this.actor=ctx.actor;this.role=ctx.role;this.placeMemory=new PlaceMemory(this);}
  async catalog(){return this.placeMemory.catalog();}
  async lookupPlace(query){return lookupCampusPlace(query,await this.catalog());}
  locationView(record,catalog){if(!record.body.location)return record;const info=refreshLocation(record.body.location,record.body.locationInfo,catalog);return {...record,body:{...record.body,location:info.label,locationInfo:info}};}
  taskView(record,catalog){const criteria=record.body.criteria;if(!criteria.location)return record;const info=refreshLocation(criteria.location,criteria.locationInfo,catalog);return {...record,body:{...record.body,criteria:{...criteria,location:info.label,locationInfo:info}}};}
  async audit(action,detail={}){await this.store.add('audit',this.actor,{action,detail});}
  async testModel(input){
    const config=resolveModelConfig(this.ctx.env||{},input);
    if(config.disabled||!config.local&&!config.key)fail('请先启用并配置模型；规则辅助不需要连接测试。');
    const suffix='model-check:'+this.actor+':'+Math.floor(Date.now()/20000);
    let check;
    try{check=await this.store.add('model_check',this.actor,{status:'testing'},suffix);}
    catch(error){if(await this.store.get(this.store.space+':'+suffix))fail('刚刚测试过模型，请等待20秒再试。',429);throw error;}
    const result=await testModelConnection(this.ctx.env||{},input);
    await this.store.save(check,{status:'done',code:result.code,connected:result.connected,toolCalling:result.toolCalling,provider:result.provider,model:result.model,elapsedMs:result.elapsedMs});
    return result;
  }
  async item(id){const r=await this.store.get(id);if(!r||r.kind!=='item')fail('这条物品记录不存在。',404);return this.locationView(r,await this.catalog());}
  async task(id){const r=await this.store.get(id);if(!r||r.kind!=='task'||r.owner!==this.actor)fail('无法访问这个寻物任务。',404);return this.taskView(r,await this.catalog());}
  async candidates(task,catalog){if(task.body.intent==='place-learning')return [];const items=await this.store.list('item');const feedback=(await this.store.list('feedback')).filter(f=>f.body.taskId===task.id&&f.owner===task.owner&&!f.body.restored);return rank(task.body.criteria,items,feedback.map(f=>f.body.itemId),catalog||await this.catalog());}
  async searchDiagnostics(task,matches){
    if(task.body.intent==='place-learning')return null;
    const feedback=(await this.store.list('feedback')).filter(f=>f.body.taskId===task.id&&f.owner===task.owner&&!f.body.restored);
    return diagnoseSearch(task.body.criteria,await this.store.list('item'),feedback.map(f=>f.body.itemId),await this.catalog(),matches);
  }
  async exclusions(task){
    const items=new Map((await this.store.list('item')).map(i=>[i.id,i]));
    return (await this.store.list('feedback')).filter(f=>f.owner===this.actor&&f.body.taskId===task.id&&!f.body.restored&&items.has(f.body.itemId)).map(f=>({item:publicItem(items.get(f.body.itemId)),reason:f.body.reason}));
  }
  matchView(m){return {item:publicItem(m.item),score:m.score,reasons:m.reasons,conflicts:m.conflicts,pending:m.pending||[],matchedFields:m.matchedFields||0,unknown:m.unknown};}
  async newTask(input){
    const text=required(input.text||input.title,'寻物描述',2000);
    const r=await this.store.add('task',this.actor,{title:clean(input.title||text,90),description:text,criteria:criteriaFrom(input.criteria,{},await this.catalog()),intent:input.intent==='place-learning'?'place-learning':'search',status:'searching',subscribed:false,source:this.ctx.demo?'演示任务':'用户提交',...('imageId'in input?{imageId:clean(input.imageId,180)}:{})});
    await this.audit('create_task',{taskId:r.id});return r;
  }
  async updateCriteria(taskId,patch){const t=await this.task(taskId);if(t.body.status==='found'||t.body.status==='cancelled')fail('任务已结束，请新建任务。');return this.store.save(t,{...t.body,criteria:{...t.body.criteria,...criteriaFrom(patch,t.body.criteria,await this.catalog())}});}
  async notify(owner,body,key){
    const suffix=key?'notice:'+owner+':'+key:undefined;if(suffix&&await this.store.get(this.store.space+':'+suffix))return;
    try{await this.store.add('notification',owner,{...body,key,read:false},suffix);}catch(e){if(!suffix||!await this.store.get(this.store.space+':'+suffix))throw e;}
  }
  async processItem(item){
    // Every pending event is durable; running again is safe because notifications use a task-item key.
    const tasks=(await this.store.list('task')).filter(t=>t.body.subscribed&&t.body.status==='searching');
    const catalog=await this.catalog();let count=0;for(const t of tasks){
      const excluded=(await this.store.list('feedback')).some(f=>f.body.taskId===t.id&&f.body.itemId===item.id&&!f.body.restored);
      if(excluded)continue;
      const m=rank(t.body.criteria,[item],[],catalog)[0];
      if(m&&m.score>=55&&t.body.criteria.category){await this.notify(t.owner,{title:'你的寻物任务有新线索',message:item.body.title+' · '+item.body.location,taskId:t.id,itemId:item.id,type:'match'},'match:'+t.id+':'+item.id);count++;}
    }return count;
  }
  async processEvents(){const events=(await this.store.list('event')).filter(e=>e.body.status==='pending').slice(0,20);for(const event of events){try{const item=await this.store.get(event.body.itemId);if(item)await this.processItem(item);await this.store.save(event,{...event.body,status:'done'});}catch{/* Leave pending so a later authorized request can recover. */}}}
  async createItem(input){
    const category=required(input.category,'类别',30);if(!CATEGORIES.includes(category))fail('请选择有效类别。');
    const body={title:required(input.title,'物品名称',80),category,color:clean(input.color,25),brand:clean(input.brand,60),location:required(input.location,'拾获地点',100),date:clean(input.date,30),description:required(input.description,'物品描述',1500),custody:required(input.custody,'保管去向',150),privateNote:clean(input.privateNote,1000),contact:clean(input.contact,150),status:'available',demo:this.ctx.demo,art:clean(input.art||'other',30),imageId:clean(input.imageId,180),imageHash:/^[a-f0-9]{16}$/i.test(input.imageHash||'')?input.imageHash:''};
    body.locationInfo=resolveCampusLocation(body.location,null,await this.catalog());body.location=body.locationInfo.label;
    let item;
    if(body.imageId){const media=await this.store.get(body.imageId);if(!media||media.kind!=='media'||media.owner!==this.actor)fail('照片不可用，请重新上传。');if(media.body.publicItemId)fail('这张照片已用于其他登记，请重新上传。',409);
      item=this.store.record('item',this.actor,body);await this.store.saveMany([{record:media,body:{...media.body,publicItemId:item.id}}],[item]);
    }else item=await this.store.add('item',this.actor,body);
    if(body.locationInfo.status==='unmapped')await this.placeMemory.observe(body.locationInfo.raw,{candidateName:detectPlaceTeaching('在'+body.locationInfo.raw,await this.catalog())?.name||'',sourceText:body.locationInfo.raw});
    const event=await this.store.add('event',this.actor,{type:'item_created',itemId:item.id,status:'pending'});
    await this.processItem(item);
    await this.store.save(event,{...event.body,status:'done'});
    await this.audit('publish_item',{itemId:item.id});return publicItem(item);
  }
  async feedback(input){const t=await this.task(input.taskId);if(['found','cancelled'].includes(t.body.status))fail('任务已结束，请新建任务。',409);const item=await this.item(input.itemId);const all=await this.store.list('feedback');const existing=all.find(f=>f.owner===this.actor&&f.body.taskId===t.id&&f.body.itemId===item.id);
    const body={taskId:t.id,itemId:item.id,reason:clean(input.reason||'用户确认不是这件',300),restored:!!input.restore};
    if(existing)await this.store.save(existing,body);else await this.store.add('feedback',this.actor,body);
    await this.audit(input.restore?'restore_candidate':'exclude_candidate',body);return {ok:true};
  }
  async subscribe(taskId,value=true){const t=await this.task(taskId);if(t.body.intent==='place-learning')fail('地点学习不属于寻物订阅，请先描述丢失的物品。',409);if(['found','cancelled'].includes(t.body.status))fail('任务已结束，请新建任务。',409);return this.store.save(t,{...t.body,subscribed:value,status:value?'searching':t.body.status});}
  async claim(input){const t=await this.task(input.taskId),item=await this.item(input.itemId);if(['found','cancelled'].includes(t.body.status))fail('任务已结束。',409);if(item.body.status!=='available')fail('这件物品正在交接或已结束认领。',409);if(item.owner===this.actor)fail('不能认领自己登记的物品。');
    const old=(await this.store.list('claim')).find(c=>c.owner===this.actor&&c.body.taskId===t.id&&c.body.itemId===item.id&&!['rejected','cancelled'].includes(c.body.status));if(old)return this.claimView(old);
    const proof=required(input.proof,'用于核实的非公开特征或凭据说明',1000);if(proof.length<4)fail('请补充更具体的物品特征或凭据，至少4个字。');
    const c=await this.store.add('claim',this.actor,{taskId:t.id,itemId:item.id,holder:item.owner,status:'pending',proof,itemTitle:item.body.title,location:item.body.custody,pickupCode:null,note:'等待保管人核实',attempts:0});
    await this.notify(item.owner,{title:'收到认领核实申请',message:item.body.title,claimId:c.id,type:'claim'},'claim:'+c.id);
    await this.audit('request_claim',{claimId:c.id,itemId:item.id});return this.claimView(c);
  }
  claimView(c){const b={...c.body};if(c.owner!==this.actor)delete b.pickupCode;return {id:c.id,owner:c.owner,created:c.created,body:b,canReview:c.body.holder===this.actor||this.role==='admin',isClaimant:c.owner===this.actor};}
  async actClaim(id,input){
    let c=await this.store.get(id);if(!c||c.kind!=='claim')fail('认领申请不存在。',404);const b=c.body,item=await this.item(b.itemId),holder=b.holder===this.actor||this.role==='admin',claimant=c.owner===this.actor;
    if(!holder&&!claimant)fail('无权处理该申请。',403);
    const action=input.action;
    if(action==='approve'){
      if(!holder)fail('只有保管人可以确认核实结果。',403);if(b.status!=='pending')fail('申请状态已变化。',409);if(item.body.status!=='available')fail('这件物品已被其他申请占用。',409);
      const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
      [c]=await this.store.saveMany([{record:c,body:{...b,status:'approved',pickupCode:code,codeExpires:Date.now()+24*3600e3,note:clean(input.note||'保管人已核实，请协商领取时间。',300)}},{record:item,body:{...item.body,status:'reserved',claimId:c.id}}]);
      await this.notify(c.owner,{title:'核实通过，可以安排领取',message:b.itemTitle,claimId:c.id,type:'claim'},'approved:'+c.id);
    }else if(action==='reject'){
      if(!holder)fail('只有保管人可以反馈核实结果。',403);if(!['pending','approved'].includes(b.status))fail('当前状态无法驳回。',409);
      [c]=await this.store.saveMany([{record:c,body:{...b,status:'rejected',pickupCode:null,note:required(input.note,'未通过的原因',300)}},...(item.body.claimId===c.id?[{record:item,body:{...item.body,status:'available',claimId:null}}]:[])]);
      await this.notify(c.owner,{title:'认领核实未通过',message:c.body.note,claimId:c.id,type:'claim'},'rejected:'+c.id);
    }else if(action==='handover'){
      if(!holder)fail('只有保管人可以登记交接。',403);if(b.status!=='approved')fail('请先完成核实。',409);if(b.attempts>=5)fail('交接码尝试次数过多，请由管理员重新核实。',429);if(Date.now()>b.codeExpires)fail('交接码已过期，请重新核实。');
      if(clean(input.code,10)!==b.pickupCode){await this.store.save(c,{...b,attempts:b.attempts+1});fail('交接码不正确，请向领取人确认。');}
      [c]=await this.store.saveMany([{record:c,body:{...b,status:'handed_over',pickupCode:null,note:'物品已交接，等待领取人确认收到。'}},{record:item,body:{...item.body,status:'handed_over'}}]);
      await this.notify(c.owner,{title:'请确认是否收到物品',message:b.itemTitle,claimId:c.id,type:'claim'},'handover:'+c.id);
    }else if(action==='received'){
      if(!claimant)fail('只有领取人可以确认收到。',403);if(b.status!=='handed_over')fail('请先由保管人完成交接。',409);
      const t=await this.store.get(b.taskId);
      [c]=await this.store.saveMany([{record:c,body:{...b,status:'completed',pickupCode:null,note:'双方确认完成找回。'}},{record:item,body:{...item.body,status:'returned'}},...(t?[{record:t,body:{...t.body,status:'found',subscribed:false}}]:[])]);
      for(const other of await this.store.list('claim'))if(other.id!==c.id&&other.body.itemId===item.id&&other.body.status==='pending'){await this.store.save(other,{...other.body,status:'rejected',note:'物品已完成核实并归还。'});await this.notify(other.owner,{title:'相关物品已归还',message:item.body.title,claimId:other.id,type:'claim'},'closed:'+other.id);}
      await this.notify(b.holder,{title:'领取人已确认收到',message:b.itemTitle,claimId:c.id,type:'claim'},'received:'+c.id);
    }else if(action==='cancel'){
      if(!claimant||!['pending','approved'].includes(b.status))fail('当前无法撤销。',403);
      [c]=await this.store.saveMany([{record:c,body:{...b,status:'cancelled',pickupCode:null,note:'申请人撤销了申请。'}},...(item.body.claimId===c.id?[{record:item,body:{...item.body,status:'available',claimId:null}}]:[])]);
    }else fail('未知操作。');
    await this.audit('claim_'+action,{claimId:c.id});return this.claimView(c);
  }
  async learningResponse(proposalId,result){
    const proposal=await this.placeMemory.ownedProposal(proposalId);
    const message=result.status==='confirmed'?'已记住“'+result.name+'”。以后可按名称或别名识别；这是用户确认补充，未经校方核实。':'已取消这次地点学习，不会加入地点库。';
    const task=proposal.body.taskId?await this.task(proposal.body.taskId):null;
    const matches=task?await this.candidates(task):[];
    const response={taskId:task?.id,message,mode:'rules',activity:'place-memory',learningResult:result,learningProposal:this.placeMemory.view(proposal),traces:[{name:result.status==='confirmed'?'保存地点记忆':'取消地点学习',detail:message,at:new Date().toISOString()}],matches:matches.map(m=>this.matchView(m)),criteria:task?.body.criteria||{},execution:{modelRequests:0,toolCalls:0,usageReportedRequests:0,inputTokens:null,outputTokens:null}};
    if(task){const suffix='place-action:'+proposal.id+':'+result.status;const id=this.store.space+':'+suffix;if(!await this.store.get(id)){try{await this.store.add('message',this.actor,{...response,role:'assistant',content:message,candidateIds:matches.map(m=>m.item.id)},suffix);}catch(error){if(!await this.store.get(id))throw error;}}}
    return response;
  }
  async bootstrap(){
    await this.processEvents();
    const catalog=await this.catalog();
    const items=(await this.store.list('item')).map(i=>this.locationView(i,catalog));
    const tasks=(await this.store.list('task')).filter(t=>t.owner===this.actor&&t.body.intent!=='place-learning').map(t=>this.taskView(t,catalog));
    const claims=(await this.store.list('claim')).filter(c=>c.owner===this.actor||c.body.holder===this.actor||this.role==='admin');
    return {profile:{...this.ctx.profile,id:this.actor,role:this.role},runtime:this.ctx.runtime||null,demo:this.ctx.demo,actors:DEMO_ACTORS,items:items.map(publicItem),
      tasks:await Promise.all(tasks.map(async t=>({...t,matches:(await this.candidates(t,catalog)).map(m=>this.matchView(m)),excluded:await this.exclusions(t)}))),
      claims:claims.map(c=>this.claimView(c)),notifications:(await this.store.list('notification')).filter(n=>n.owner===this.actor),myItems:items.filter(i=>i.owner===this.actor||this.role==='admin'),categories:CATEGORIES,
      locations:[...new Set([...catalog.map(p=>p.name),...LOCATIONS])],placeCatalog:catalog,placeKnowledge:await this.placeMemory.list(),
      campus:{...CAMPUS,placeCount:catalog.length,builtinCount:CAMPUS_PLACES.length,learnedCount:catalog.filter(p=>p.learned).length,coordinatesAvailable:false},model:modelInfo(this.ctx.env),
      myPhotos:(await this.store.listOwned('media',this.actor,50)).map(r=>({id:r.id,created:r.created,published:!!r.body.publicItemId,title:items.find(i=>i.id===r.body.publicItemId)?.body.title||'未发布照片'})),
      stats:{available:items.filter(i=>i.body.status==='available').length,returned:items.filter(i=>i.body.status==='returned').length,tasks:tasks.length},seeded:items.some(i=>i.body.demo)};
  }
  async seed(reset=false){if(!this.ctx.demo)fail('体验数据只能在演示空间使用。',403);if(reset)await this.store.clear();for(const b of seedItems()){const suffix='seed-'+b.art+'-'+b.brand+'-'+b.location;if(await this.store.get(this.store.space+':'+suffix))continue;try{await this.store.add('item',b.holder,{...b},suffix);}catch(e){if(!await this.store.get(this.store.space+':'+suffix))throw e;}}return {ok:true};}
}

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
export async function handleApi(request,service){
  try{
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'');
    if(request.method==='GET'&&path==='bootstrap')return json(await service.bootstrap());
    if(request.method==='GET'&&path==='places')return json(await service.lookupPlace(clean(url.searchParams.get('query'),240)));
    if(request.method==='GET'&&path==='places/memory')return json(await service.placeMemory.list());
    if(request.method==='GET'&&path==='chat/history'){
      const task=await service.task(url.searchParams.get('taskId'));
      const items=new Map((await service.store.list('item')).map(item=>[item.id,item]));
      const proposals=new Map((await service.store.list('place_proposal')).filter(p=>p.owner===service.actor).map(p=>[p.id,service.placeMemory.view(p)]));
      const messages=(await service.store.list('message')).filter(m=>m.owner===service.actor&&m.body.taskId===task.id).sort((a,b)=>a.created.localeCompare(b.created));
      return json({messages:messages.map(m=>({...m.body,...(m.body.learningProposal?{learningProposal:proposals.get(m.body.learningProposal.id)||{...m.body.learningProposal,status:'unavailable'}}:{}),...(m.body.role==='assistant'?{historical:true,matches:(m.body.candidateIds||[]).flatMap(id=>{const item=items.get(id),evidence=(m.body.candidateEvidence||[]).find(e=>e.id===id);return item?[{item:publicItem(item),reasons:evidence?.reasons||['历史线索，以当前物品状态为准'],conflicts:evidence?.conflicts||[],pending:evidence?.pending||[],historical:true}]:[];})}:{})}))});
    }
    if(request.method==='GET'&&path==='export'){const b=await service.bootstrap();delete b.myItems;return new Response(JSON.stringify({exportedAt:new Date().toISOString(),...b},null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="xunhui-records.json"','cache-control':'no-store'}});}
    if(request.method==='GET'&&path.startsWith('media/')){
      const id=decodeURIComponent(path.slice(6)),r=await service.store.get(id);if(!r||r.kind!=='media')fail('照片不存在。',404);if(!r.body.publicItemId&&r.owner!==service.actor)fail('无权查看照片。',403);if(r.body.publicItemId&&r.owner!==service.actor){const item=await service.store.get(r.body.publicItemId);if(!item||item.kind!=='item'||item.body.status==='withdrawn')fail('该照片已撤回。',403);}const file=await service.ctx.env.BUCKET?.get(r.body.key);if(!file)fail('照片暂时不可用。',404);return new Response(file.body,{headers:{'content-type':r.body.type,'x-content-type-options':'nosniff','cache-control':'private, max-age=60'}});
    }
    if(request.method!=='POST')fail('接口不存在。',404);
    const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail('请求来源不匹配。',403);
    if(path==='media'){
      if(!service.ctx.env.BUCKET)fail('图片存储暂不可用，请先用文字登记。',503);
      if(service.ctx.runtime?.identity==='community'&&await service.store.count('media',service.actor)>=50)fail('当前账号已上传50张照片，请先用文字登记或联系组织者。',429);
      const form=await request.formData(),file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>2*1024*1024)fail('请上传不超过2MB的图片。');
      const bytes=new Uint8Array(await file.arrayBuffer());let type='';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)type='image/png';else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';if(!type)fail('仅支持JPEG、PNG、WebP图片。');
      const key='images/'+uid();await service.ctx.env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});const r=service.ctx.runtime?.identity==='community'?await service.store.addLimited('media',service.actor,{key,type,publicItemId:null},50):await service.store.add('media',service.actor,{key,type,publicItemId:null});return json({id:r.id});
    }
    if(Number(request.headers.get('content-length')||0)>180000)fail('内容过长。',413);
    const raw=await request.text();if(raw.length>180000)fail('内容过长。',413);let data={};try{data=raw?JSON.parse(raw):{};}catch{fail('提交内容格式不正确。');}
    if(!data||typeof data!=='object'||Array.isArray(data))fail('提交内容必须是JSON对象。');
    if(path==='places/propose')return json(await service.placeMemory.propose(data,{taskId:data.taskId||null,sourceText:[data.name,data.aliases,data.note].join('；')}));
    if(path==='model/test')return json(await service.testModel(data.llm||{}));
    if(path==='places/confirm'){
      if(!Number.isInteger(data.version)||data.version<1)fail('请刷新后核对当前地点草稿。');
      const result=await service.placeMemory.confirm(data.id,data);return json(await service.learningResponse(data.id,result));
    }
    if(path==='places/reject'){const result=await service.placeMemory.reject(data.id);return json(await service.learningResponse(data.id,result));}
    if(path==='places/memory/action'){if(typeof data.active!=='boolean')fail('请选择停用或恢复。');return json(await service.placeMemory.setActive(data.id,data.active,data.version));}
    if(path==='demo/init')return json(await service.seed());
    if(path==='demo/reset')return json(await service.seed(true));
    if(path==='demo/late'){
      if(!service.ctx.demo)fail('仅供演示。',403);const item=await service.createItem({title:'蓝色文件袋',category:'包袋',color:'蓝色',location:'第二教学楼',description:'二教三楼走廊拾获，透明蓝色文件袋。',date:new Date(Date.now()+8*3600e3).toISOString().slice(0,10),custody:'二教值班处（演示）',privateNote:'袋内有一张写着星期三的绿色便签',art:'folder'});return json({item});
    }
    if(path==='items')return json({item:await service.createItem(data)});
    if(path==='items/withdraw'){const item=await service.item(data.id);if(item.owner!==service.actor&&service.role!=='admin')fail('无权撤回。',403);if(item.body.status!=='available')fail('请先处理正在进行的认领。',409);await service.store.save(item,{...item.body,status:'withdrawn'});await service.audit('withdraw_item',{itemId:item.id});return json({ok:true});}
    if(path==='tasks')return json({task:await service.newTask(data)});
    if(path==='tasks/action'){const t=await service.task(data.id);if(data.action==='subscribe')await service.subscribe(t.id,true);else if(data.action==='unsubscribe')await service.subscribe(t.id,false);else if(['pause','resume','cancel'].includes(data.action)){if(['found','cancelled'].includes(t.body.status))fail('任务已结束，请新建任务。',409);await service.store.save(t,{...t.body,status:{pause:'paused',resume:'searching',cancel:'cancelled'}[data.action],subscribed:data.action==='resume'?t.body.subscribed:false});}else fail('未知任务操作。');return json({ok:true});}
    if(path==='feedback'){
      await service.feedback(data);const task=await service.task(data.taskId),matches=(await service.candidates(task)).map(m=>service.matchView(m));
      const message=data.restore?'已恢复这条线索，候选已重新核对。':'已记录排除，当前还有 '+matches.length+' 条候选；后续查询会保留这次反馈。';
      const result={taskId:task.id,message,mode:'rules',activity:'task-feedback',matches,criteria:task.body.criteria,traces:[{name:data.restore?'恢复候选':'记录排除',detail:message}]};
      await service.store.add('message',service.actor,{...result,role:'assistant',content:message,candidateIds:matches.map(m=>m.item.id)});return json(result);
    }
    if(path==='claims')return json({claim:await service.claim(data)});
    if(path==='claims/action')return json({claim:await service.actClaim(data.id,data)});
    if(path==='notifications/read'){
      if(data.id){const n=await service.store.get(data.id);if(!n||n.kind!=='notification'||n.owner!==service.actor)fail('无法访问这条通知。',403);if(!n.body.read)await service.store.save(n,{...n.body,read:true});}
      else for(const n of await service.store.list('notification'))if(n.owner===service.actor&&!n.body.read)await service.store.save(n,{...n.body,read:true});return json({ok:true});
    }
    if(path==='chat')return json(await runChat(service,data));
    if(path==='vision')return json(await visionDescription(service,data));
    fail('接口不存在。',404);
  }catch(error){return json({error:error.status?error.message:'服务暂时遇到问题，请重试。',code:error.status||500},error.status||500);}
}
