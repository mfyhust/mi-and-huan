import {CAMPUS,CAMPUS_PLACES,resolveCampusLocation,unknownLocationMention} from './campus-locations.mjs';

export const PLACE_KINDS={study:'自习空间',teaching:'教学科研',dining:'餐饮',library:'图书馆',sports:'体育',dorm:'住宿',gate:'出入口',road:'道路',landscape:'景观区域',culture:'文化场馆',service:'校园服务',medical:'医疗',admin:'行政办公',other:'其他地点'};
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const generic=new Set(['地点','新地点','一个地方','这里','那里','附近','不知道','不记得','其他地点','食堂','餐厅','自习室','实验室','图书馆','教学楼','宿舍','宿舍区','体育馆','楼上','楼下','一个自习室','某栋楼']);
const floorTail=/(?:[一二三四五六七八九十两\d]{1,2}(?:楼|层)|\d{1,2}f)(?:靠窗|门口|附近|走廊)?$/i;
function name(value){
  const text=String(value||'').normalize('NFKC').trim();
  if(text.length<2||text.length>60||generic.has(text)||!/[a-z\u3400-\u9fff]/i.test(text)||!/^[a-z0-9\u3400-\u9fff·()（） _.-]+$/i.test(text)||(floorTail.test(text)&&!/(?:号楼|栋|学生公寓)$/.test(text)))fail('请填写具体建筑或区域的名称；楼层请留在寻物描述中。');
  if(/徐汇|七宝|临港|浦东校区|张江校区|华东师范|华东师大/.test(text))fail('当前地点记忆范围为交大闵行校区。');
  return text;
}
const splitAliases=value=>Array.isArray(value)?value:String(value||'').split(/[、,，;；\n]+/);
const exact=(term,catalog)=>catalog.find(p=>p.aliases.some(a=>norm(a)===norm(term)));
const short=p=>({id:p.id,name:p.name,kind:p.kind});
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}

export function isPlaceTeaching(text){return /记住.{0,12}(?:地点|叫|楼|馆|室|苑|园|中心)|(?:新地点|教你|学习地点|补充地点|补充别名|地点叫|正式名称|别名|简称|又叫|也叫|大家叫)/.test(text);}
export function isLearningOnly(text){return isPlaceTeaching(text)&&!/丢|遗失|落在|掉在|找回/.test(text);}
export function learningReply(text){
  const s=norm(text).replace(/[，。！!；;\s]/g,'');
  if(/^(?:先)?(?:不要|不用|别|不|取消|先不|暂不)(?:记住|保存|学习|记|地点学习|这个地点|这条记忆)/.test(s)||/^(?:取消学习|取消保存|暂不保存)$/.test(s))return 'reject';
  if(/^(?:好(?:的)?|请|帮我)?(?:确认(?:并)?(?:记住|保存)(?:这个地点|地点|它)?|记住这个地点|保存这个地点)$/.test(s))return 'confirm';
  return null;
}
function kindFor(value){if(/自习|书屋/.test(value))return 'study';if(/食堂|餐厅|餐饮/.test(value))return 'dining';if(/图书馆/.test(value))return 'library';if(/体育|球场|健身/.test(value))return 'sports';if(/宿舍|公寓/.test(value))return 'dorm';if(/教学|实验|科研|楼|院/.test(value))return 'teaching';return 'other';}
function trimPlace(value){return String(value||'').replace(/^(?:记住(?:一个)?(?:新地点)?|教你(?:一个)?(?:新地点)?|新地点|地点|它|这里|这个地方|正式名称)(?:是|叫|为)?[：:]?\s*/,'').replace(/^[“「"']|[”」"']$/g,'').replace(/(?:[一二三四五六七八九十两\d]{1,2}(?:楼|层)|\d{1,2}f).*$/i,'').trim();}

// A local fallback for common teaching/loss phrases. Models can propose other
// phrasings through the same grounded, confirmation-only tool below.
export function detectPlaceTeaching(text,catalog=CAMPUS_PLACES){
  const s=String(text||'').normalize('NFKC');let canonical='',aliases=[];
  const aliasMatch=s.match(/([^,，。；;：:“”"!?！？]{2,60}?)(?:简称|别名(?:是|叫)?|又叫|也叫|大家叫(?:它)?)(?:作|做|是|叫)?[：:]?\s*[“「"]?([^,，。；;：“”"!?！？]{2,60})/);
  if(aliasMatch){
    const left=aliasMatch[1].replace(/^.*(?:地点[：:]|在|叫|是)/,'');
    canonical=trimPlace(left);aliases=splitAliases(aliasMatch[2].replace(/[）)].*$/,'')).map(trimPlace);
  }
  if(!aliases.length){const only=s.match(/(?:简称|别名(?:是|叫)?|又叫|也叫|大家叫(?:它)?)(?:作|做|是|叫)?[：:]?\s*[“「"]?([^,，。；;：“”"!?！？]{2,60})/);if(only)aliases=splitAliases(only[1].replace(/[）)].*$/,'')).map(trimPlace);}
  if(!canonical){
    const explicit=s.match(/(?:新地点|补充地点|地点叫|正式名称)(?:是|叫|为)?[：:]?\s*[“「"]?([^,，。；;：“”"!?！？]{2,60})/);
    if(explicit)canonical=trimPlace(explicit[1].split(/[（(]/)[0]);
  }
  if(!canonical){
    const match=s.match(/(?:在|到|从|记住|叫)\s*[“「"]?([^\s,，。；;：:“”"!?！？]{2,40}?(?:自习室|自习空间|实验室|图书馆|餐厅|食堂|公寓|学院|中心|书屋|楼|馆|室|苑|园|站|亭|坊|店))/);
    if(match)canonical=trimPlace(match[1]);
  }
  if(!canonical){
    const match=s.match(/(?:在|到|从)\s*([^\s,，。；;：:“”"!?！？]{2,30}?)(?:[一二三四五六七八九十两\d]{1,2}(?:楼|层)|\d{1,2}f)/i);
    if(match)canonical=trimPlace(match[1]);
  }
  if(!canonical){const unknown=unknownLocationMention(s,catalog);if(unknown)canonical=unknown.name;}
  if(!canonical)return null;
  const literal=unknownLocationMention(s,catalog);if(literal&&!isPlaceTeaching(s))canonical=literal.name;
  try{canonical=name(canonical);aliases=aliases.filter(Boolean).map(name);}catch{return null;}
  const known=exact(canonical,catalog);
  if(!known&&!/自习|实验|楼|馆|室|苑|园|中心|书屋|餐厅|食堂|公寓|学院|球场|站|亭|坊|店/.test(canonical)&&!/新地点|补充地点|地点叫|正式名称/.test(s)&&!unknownLocationMention(s,catalog))return null;
  if(known&&!aliases.some(a=>!known.aliases.some(b=>norm(a)===norm(b))))return null;
  const note=s.match(/(?:位置说明|位置|位于|在)[：:]?([^,，。；;]{2,100}(?:旁边|附近|北侧|南侧|东侧|西侧))/)?.[1]||'';
  return {name:canonical,aliases,kind:known?.kind||kindFor(canonical),note};
}

export class PlaceMemory {
  constructor(service){this.service=service;this.store=service.store;this.actor=service.actor;}
  personalScope(){return this.service.ctx.runtime?.identity==='community';}
  termKey(term){return digest((this.personalScope()?this.actor+':':'')+norm(term));}
  async memories(){return (await this.store.list('place_memory')).filter(r=>!this.personalScope()||r.owner===this.actor);}
  async catalog(){
    const memories=(await this.memories()).filter(r=>r.body.status==='active');
    const places=CAMPUS_PLACES.map(p=>({...p,aliases:[...p.aliases],learnedAliases:[]}));
    for(const r of memories.filter(r=>r.body.type==='place'))places.push({id:r.id,name:r.body.name,kind:r.body.kind,aliases:[r.body.name,...r.body.aliases],note:r.body.note,coordinates:null,source:{type:'user-confirmed',title:'用户确认补充，未经校方核实',confirmedAt:r.body.confirmedAt},learned:true,learnedAliases:[]});
    for(const r of memories.filter(r=>r.body.type==='alias')){
      const target=places.find(p=>p.id===r.body.targetId);if(!target)continue;
      target.aliases.push(...r.body.aliases);
      target.learnedAliases.push(...r.body.aliases.map(alias=>({alias,note:r.body.note,source:'用户确认补充，未经校方核实',confirmedAt:r.body.confirmedAt})));
    }
    return places.map(p=>({...p,aliases:[...new Set(p.aliases)]}));
  }
  view(record){const {sourceText,...body}=record.body;return {id:record.id,version:record.version,...body,canManage:record.owner===this.actor||this.service.role==='admin'};}
  async observe(raw,{taskId=null,candidateName='',sourceText=''}={}){
    const info=resolveCampusLocation(raw,null,await this.catalog());
    if(!raw||info.status!=='unmapped')return null;
    const suffix='place-observation:'+await digest(JSON.stringify([this.actor,taskId,String(raw).slice(0,240)]));
    let r=await this.store.get(this.store.space+':'+suffix);
    if(!r){try{r=await this.store.add('place_observation',this.actor,{raw:String(raw).slice(0,240),candidateName,taskId,sourceText:String(sourceText).slice(-2000),source:'用户原话，未核实，尚未加入公共地点库'},suffix);}catch(error){r=await this.store.get(this.store.space+':'+suffix);if(!r)throw error;}}
    return this.view(r);
  }
  async list(){
    const catalog=await this.catalog();
    const observations=(await this.store.list('place_observation')).filter(r=>r.owner===this.actor).map(r=>({...this.view(r),recognitionStatus:resolveCampusLocation(r.body.raw,null,catalog).status}));
    const memories=await this.memories(),proposals=await this.store.list('place_proposal');
    return {builtinCount:CAMPUS_PLACES.length,observations,memories:memories.filter(r=>r.body.status==='active'||r.owner===this.actor||this.service.role==='admin').map(r=>this.view(r)),proposals:proposals.filter(r=>r.owner===this.actor&&r.body.status==='pending').map(r=>this.view(r))};
  }
  async prepare(input,catalog){
    const enteredName=name(input.name),known=exact(enteredName,catalog);
    const aliases=[...new Map(splitAliases(input.aliases).filter(a=>String(a).trim()).map(a=>{const v=name(a);return [norm(v),v];})).values()];
    if(aliases.length>8)fail('一次最多补充8个别名。');
    const kind=input.kind||known?.kind||kindFor(enteredName);if(!PLACE_KINDS[kind])fail('请选择有效地点类别。');
    const targetId=known?.id||this.store.space+':place-memory:'+await this.termKey(enteredName);
    for(const term of [enteredName,...aliases]){const existing=exact(term,catalog);if(existing&&existing.id!==targetId)fail('“'+term+'”已指向另一地点，请使用更具体的称呼。',409);}
    const note=String(input.note||'').trim();if(note.length>240)fail('位置说明请控制在240字以内。');
    return {name:known?.name||enteredName,enteredName,aliases:aliases.filter(a=>norm(a)!==norm(known?.name||enteredName)),kind:known?.kind||kind,targetId,type:known?'alias':'place',note};
  }
  async propose(input,{taskId=null,sourceText='',grounded=false}={}){
    const catalog=await this.catalog(),data=await this.prepare(input,catalog);
    if(grounded){
      const evidence=norm(sourceText);
      for(const field of [data.enteredName,...data.aliases,...(data.note?[data.note]:[])])if(!evidence.includes(norm(field)))fail('只能学习用户实际提供的名称、别名和说明，不能补造。');
    }
    const existing=catalog.find(p=>p.id===data.targetId);
    if(existing&&data.aliases.every(a=>existing.aliases.some(b=>norm(a)===norm(b))))return {status:'known',place:short(existing)};
    let task=taskId?await this.service.task(taskId):null;
    let fingerprint=await digest(JSON.stringify([this.actor,taskId,data.name,[...data.aliases].sort(),data.note]));
    let id=this.store.space+':place-proposal:'+fingerprint;
    let proposal=await this.store.get(id);
    // A fresh explicit teaching request can retry a previously declined draft.
    while(proposal?.body.status==='rejected'){
      fingerprint=await digest(fingerprint+':retry:'+proposal.updated);
      id=this.store.space+':place-proposal:'+fingerprint;proposal=await this.store.get(id);
    }
    if(!proposal){
      if(task?.body.pendingPlaceProposalId){const pending=await this.store.get(task.body.pendingPlaceProposalId);if(pending?.body.status==='pending')return this.view(pending);}
      const body={...data,status:'pending',taskId,sourceText:String(sourceText).slice(-2000),scope:this.personalScope()?'当前账号':'当前校园空间',source:'用户提供，等待本人确认',confirmedAt:null};
      try{proposal=await this.store.add('place_proposal',this.actor,body,'place-proposal:'+fingerprint);}catch(error){proposal=await this.store.get(id);if(!proposal)throw error;}
    }
    if(task&&proposal.body.status==='pending'&&task.body.pendingPlaceProposalId!==id){task=await this.service.task(taskId);await this.store.save(task,{...task.body,pendingPlaceProposalId:id});}
    return this.view(proposal);
  }
  async ownedProposal(id){const p=await this.store.get(id);if(!p||p.kind!=='place_proposal'||p.owner!==this.actor)fail('无法访问这条地点学习请求。',404);return p;}
  async pendingForTask(task){const p=task.body.pendingPlaceProposalId?await this.store.get(task.body.pendingPlaceProposalId):null;return p&&p.owner===this.actor&&p.body.status==='pending'?this.view(p):null;}
  async confirm(id,options={},retry=true){
    const p=await this.ownedProposal(id);
    if(p.body.status==='confirmed')return {status:'confirmed',memoryId:p.body.memoryId,placeId:p.body.targetId,name:p.body.name,alreadyConfirmed:true};
    if(p.body.status!=='pending')fail('这条学习请求已取消，请重新提供地点。',409);
    if(options.version!==undefined&&options.version!==p.version)fail('地点草稿已更新，请刷新后核对。',409);
    const catalog=await this.catalog(),data=await this.prepare({...p.body,...options},catalog);
    const additions=[],changes=[],now=new Date().toISOString();
    let memoryId=null;
    const existing=catalog.find(x=>x.id===data.targetId);
    const newAliases=data.aliases.filter(a=>!existing?.aliases.some(b=>norm(a)===norm(b)));
    if(data.type==='place'||newAliases.length){
      const suffix=data.type==='place'?data.targetId.slice(this.store.space.length+1):'place-alias:'+await digest(p.id);
      const record=this.store.record('place_memory',this.actor,{type:data.type,name:data.name,aliases:data.type==='place'?data.aliases:newAliases,kind:data.kind,note:data.note,targetId:data.targetId,status:'active',confirmedAt:now,source:'用户确认补充，未经校方核实',proposalId:p.id},suffix);
      if(await this.store.get(record.id))fail('该地点曾被记住，请在地点记忆中恢复或核对原记录。',409);
      memoryId=record.id;additions.push(record);
      for(const term of data.type==='place'?[data.name,...data.aliases]:newAliases){
        const key='place-term:'+await this.termKey(term);
        const old=await this.store.get(this.store.space+':'+key);
        if(old){
          if(old.body.targetId!==data.targetId){
            const previous=await this.store.get(old.body.memoryId);
            if(!previous||previous.body.status!=='inactive')fail('“'+term+'”已被其他地点占用，请核对。',409);
            // Reassign a mistaken, disabled alias in the same guarded transaction.
            if(!changes.some(c=>c.record.id===previous.id))changes.push({record:previous,body:previous.body});
            changes.push({record:old,body:{term,targetId:data.targetId,memoryId:record.id}});
          }
          continue;
        }
        additions.push(this.store.record('place_term',this.actor,{term,targetId:data.targetId,memoryId:record.id},key));
      }
    }
    changes.push({record:p,body:{...p.body,...data,status:'confirmed',memoryId,targetId:data.targetId,confirmedAt:now,source:'用户确认补充，未经校方核实'}});
    if(p.body.taskId){const task=await this.service.task(p.body.taskId);if(task.body.pendingPlaceProposalId===p.id)changes.push({record:task,body:{...task.body,pendingPlaceProposalId:null}});}
    try{await this.store.saveMany(changes,additions);}catch(error){
      const fresh=await this.store.get(p.id);if(fresh?.body.status==='confirmed')return {status:'confirmed',memoryId:fresh.body.memoryId,placeId:fresh.body.targetId,name:fresh.body.name,alreadyConfirmed:true};
      if(retry&&(error.status===409||/UNIQUE|constraint/i.test(error.message)))return this.confirm(id,options,false);
      throw error;
    }
    await this.service.audit('learn_place',{proposalId:id,placeId:data.targetId,type:data.type});
    return {status:'confirmed',memoryId,placeId:data.targetId,name:data.name,aliases:data.aliases,source:'用户确认补充，未经校方核实'};
  }
  async reject(id){
    const p=await this.ownedProposal(id);if(p.body.status==='rejected')return {status:'rejected'};
    if(p.body.status!=='pending')fail('已保存的地点请到地点记忆中停用。',409);
    const changes=[{record:p,body:{...p.body,status:'rejected'}}];
    if(p.body.taskId){const task=await this.service.task(p.body.taskId);if(task.body.pendingPlaceProposalId===id)changes.push({record:task,body:{...task.body,pendingPlaceProposalId:null}});}
    await this.store.saveMany(changes);return {status:'rejected'};
  }
  async setActive(id,active,version){
    const record=await this.store.get(id);if(!record||record.kind!=='place_memory'||(record.owner!==this.actor&&this.service.role!=='admin'))fail('无权修改这条地点记忆。',403);
    if(version!==undefined&&version!==record.version)fail('地点记忆已更新，请刷新。',409);
    if(active){
      const catalog=await this.catalog();
      if(record.body.type==='alias'&&!catalog.some(p=>p.id===record.body.targetId))fail('请先恢复这个别名对应的地点。',409);
      for(const term of record.body.type==='place'?[record.body.name,...record.body.aliases]:record.body.aliases){
        const other=exact(term,catalog),claim=await this.store.get(this.store.space+':place-term:'+await this.termKey(term));
        if(other&&other.id!==record.body.targetId||claim&&claim.body.targetId!==record.body.targetId)fail('该称呼目前指向另一地点，不能直接恢复。',409);
      }
    }
    return this.view(await this.store.save(record,{...record.body,status:active?'active':'inactive'}));
  }
}
