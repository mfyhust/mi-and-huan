import {CAMPUS,CAMPUS_PLACES,PLACE_SOURCES} from '../data/campus-minhang.mjs';
export {CAMPUS,CAMPUS_PLACES,PLACE_SOURCES};
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const generic=[['图书馆','library'],['图馆','library'],['图书室','library'],['食堂','dining'],['餐厅','dining'],['体育馆','sports'],['操场','sports'],['球馆','sports'],['宿舍区','dorm'],['宿舍','dorm'],['寝室','dorm']];
const legacy=[['第一教学楼',['第一教学楼','一教','1教']],['第二教学楼',['第二教学楼','二教','2教']]];
const details=[['靠窗',['靠窗','窗边']],['门口',['门口']],['东门',['东门']],['西门',['西门']],['南门',['南门']],['北门',['北门']],['楼梯口',['楼梯口']],['电梯口',['电梯口']],['走廊',['走廊']],['大厅',['大厅']],['服务台',['服务台']],['自习区',['自习区']]];
const floorUnknownPattern=/不记得(?:在)?几[楼层]|不知道(?:在)?几[楼层]|记不清(?:在)?几[楼层]|(?:忘了|不记得|记不清|不确定).{0,3}楼层|楼层.{0,3}(?:忘了|不记得|记不清|不确定)/;
const buildingUnknownPattern=/(?:不记得|不知道|记不清|不确定).{0,5}(?:哪[一座个栋家]|馆名|具体建筑)|(?:哪[一座个栋家]|馆名|具体建筑).{0,5}(?:不记得|不知道|记不清|不确定)/;
function floorNumber(s){
  if(/^\d+$/.test(s))return Number(s);
  const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if(s==='十')return 10;
  if(s.includes('十')){const [a,b]=s.split('十');return (digits[a]||1)*10+(digits[b]||0);}
  return digits[s]??NaN;
}
export function floorLabel(n){return n<0?'地下'+Math.abs(n)+'层':n+'楼';}
function floors(text){
  if(floorUnknownPattern.test(text))return [];
  const values=[];
  const range=/([一二三四五六七八九十两\d]{1,2})(?:楼|层)?(?:或|或者|、|至|到|-)([一二三四五六七八九十两\d]{1,2})(?:楼|层)/g;
  const denied=index=>/(?:不是|不在|并非|排除)(?:第)?$/.test(text.slice(Math.max(0,index-6),index));
  for(const m of text.matchAll(range))if(!denied(m.index))values.push(floorNumber(m[1]),floorNumber(m[2]));
  const pattern=/(?:地下|负)([一二三四五六七八九十两\d]{1,2})(?:楼|层)?|b([0-9]{1,2})(?![\da-z])|第?([一二三四五六七八九十两\d]{1,2})(?:楼|层)|([0-9]{1,2})f(?![\da-z])/g;
  for(const m of text.matchAll(pattern))if(!denied(m.index))values.push(m[1]?-floorNumber(m[1]):m[2]?-Number(m[2]):floorNumber(m[3]||m[4]));
  return [...new Set(values.filter(n=>Number.isInteger(n)&&n!==0&&n>=-5&&n<=99))];
}
function negativeFloors(text){
  return [...text.matchAll(/(?:不是|不在|并非|排除)(?:第)?([一二三四五六七八九十两\d]{1,2})(?:楼|层)/g)].map(m=>floorNumber(m[1]));
}
function detail(text){return details.filter(([,terms])=>terms.some(t=>text.includes(t))).map(([name])=>name).join('、');}
function relation(text){return /路上|途中|走到|走回/.test(text)?'route':/附近|周边|旁边/.test(text)?'nearby':'inside';}
const summary=p=>({id:p.id,name:p.name,kind:p.kind,...(p.parentId?{parentId:p.parentId}:{}),...(p.learned?{learned:true}:{})});
function hitsIn(text,catalog=CAMPUS_PLACES){
  const found=[];
  for(const p of catalog)for(const alias of p.aliases){
    const a=norm(alias);let start=0;
    while((start=text.indexOf(a,start))>=0){
      // Reject an Arabic alias embedded in another number, e.g. 15餐 is not 5餐.
      const misleading=/^(?:案|片|像|纸|标)/.test(text.slice(start+a.length))&&['主图','新图','包图','李图'].includes(a);
      const printed=/(?:印着|印有|写着|字样是|图案是|照片是)$/.test(text.slice(Math.max(0,start-6),start));
      const numberedBoundary=/[0-9]$/.test(a)&&/[0-9a-z]/i.test(text[start+a.length]||'')||/^[a-z]\d/i.test(a)&&/[a-z0-9]/i.test(text[start-1]||'');
      if(!misleading&&!printed&&!numberedBoundary&&!(/^\d/.test(a)&&/\d/.test(text[start-1]||'')))found.push({place:p,start,end:start+a.length});
      start+=a.length;
    }
  }
  const selected=[];
  for(const h of found.sort((a,b)=>(b.end-b.start)-(a.end-a.start)))if(!selected.some(s=>h.start<s.end&&s.start<h.end))selected.push(h);
  return selected.sort((a,b)=>a.start-b.start);
}
const negative=(text,hit)=>{const prefix=text.slice(Math.max(0,hit.start-10),hit.start);return !/是不是$/.test(prefix)&&/(?:不是|不在|并非|没去|排除).{0,2}$/.test(prefix);};
function decorate(info){
  if(info.status==='outside_scope'||info.unmappedName)return {...info,label:info.raw};
  let label=info.places.map(p=>p.name+(p.floors.length?p.floors.map(floorLabel).join('或'):'')+(p.relation==='nearby'?'附近':p.relation==='route'?'途中':'')+(p.detail?' · '+p.detail:'')).join(' / ');
  if(!label)label=(info.genericName||'')+(info.pendingFloors.length?info.pendingFloors.map(floorLabel).join('或'):'')+(info.detail?' · '+info.detail:'');
  if(!label)label=info.raw;
  if(info.places.length>1&&info.pendingFloors.length)label+='（补充楼层待关联）';
  return {...info,label};
}

export function resolveCampusLocation(value,previous=null,catalog=CAMPUS_PLACES){
  const raw=String(value||'').trim().slice(0,240),text=norm(raw);
  const prior=typeof previous==='string'?resolveCampusLocation(previous,null,catalog):previous;
  const base={campusId:CAMPUS.id,campusName:CAMPUS.name,raw,status:'unmapped',places:[],candidates:[],pendingFloors:[],genericName:'',kind:null,uncertain:/可能|大概|也许|不确定/.test(text),floorUnknown:floorUnknownPattern.test(text),buildingUnknown:buildingUnknownPattern.test(text),detail:detail(text)};
  if(!text)return {...base,label:''};
  if(/徐汇|七宝|临港|浦东校区|张江校区|华东师范|华东师大/.test(text))return decorate({...base,campusId:null,status:'outside_scope'});
  const allHits=hitsIn(text,catalog),positive=allHits.filter(h=>!negative(text,h));
  const unique=[...new Map(positive.map(h=>[h.place.id,h])).values()];
  if(unique.length){
    const places=unique.slice(0,6).map((hit,index)=>{
      const segment=text.slice(hit.end,positive.find(h=>h.start>=hit.end)?.start??text.length);
      // In a correction, only the final floor statement is retained.
      const relevant=/(?:不是|并非).{0,8}(?:而是|是)/.test(segment)?segment.slice(Math.max(segment.lastIndexOf('而是'),segment.lastIndexOf('是'))+1):segment;
      const known=prior?.places?.find(p=>p.id===hit.place.id);
      const parsed=floors(relevant);
      const levelUnknown=floorUnknownPattern.test(relevant)||(unique.length===1&&base.floorUnknown)||(!parsed.length&&!!known?.floorUnknown);
      const userAlias=hit.place.learnedAliases?.some(a=>norm(a.alias)===text.slice(hit.start,hit.end))||known?.aliasSource==='user-confirmed'&&hit.place.learnedAliases?.some(a=>norm(prior.raw).includes(norm(a.alias)));
      return {...summary(hit.place),...(userAlias?{aliasSource:'user-confirmed'}:{}),floors:levelUnknown?[]:parsed.length?parsed:(known?.floors||[]),detail:detail(relevant)||known?.detail||'',relation:relation(relevant),floorUnknown:levelUnknown};
    });
    if(prior?.places?.length>1&&places.length===1&&prior.pendingFloors?.length&&!/只有|就是|确定|不是|不在|改成|改为|更正|只可能|排除/.test(text)){
      const selected=places[0];
      if(!selected.floors.length)selected.floors=prior.pendingFloors;
      const merged=prior.places.map(p=>p.id===selected.id?selected:p);
      return decorate({...prior,raw,status:'resolved',places:merged,pendingFloors:[],uncertain:true});
    }
    return decorate({...base,status:'resolved',places,floorUnknown:places.length===1?places[0].floorUnknown:base.floorUnknown,kind:places.every(p=>p.kind===places[0].kind)?places[0].kind:null,uncertain:base.uncertain||places.length>1||places.some(p=>p.floors.length>1)});
  }
  if(allHits.length&&prior?.places?.length){
    const removed=new Set(allHits.map(h=>h.place.id)),places=prior.places.filter(p=>!removed.has(p.id));
    return decorate({...base,status:places.length?'resolved':'unmapped',places,uncertain:places.length>1});
  }
  const genericHit=generic.find(([name])=>text.includes(name));
  const prefix=genericHit?text.slice(0,text.indexOf(genericHit[0])).replace(/^.*(?:在|到|从|可能|大概|也许|或者)/,''):'';
  const namedGeneric=!!prefix&&!base.buildingUnknown&&/^[a-z\u3400-\u9fff]{2,30}$/.test(prefix)&&!/^(?:一个|某个|学校|校内|校园|附近|那家|这家|丢在的|不确定的)$/.test(prefix);
  const group=namedGeneric?null:genericHit;
  const oldName=legacy.find(([,aliases])=>aliases.some(a=>text.includes(a)));
  const parsed=floors(text);
  if(group||oldName){
    const kind=group?.[1]||'teaching';
    if(group&&prior?.places?.length===1&&prior.places[0].kind===kind){
      const p=prior.places[0];
      const unknown=base.floorUnknown||(!parsed.length&&prior.floorUnknown);
      return decorate({...prior,raw,floorUnknown:unknown,places:[{...p,floors:base.floorUnknown?[]:parsed.length?parsed:p.floors,detail:base.detail||p.detail,floorUnknown:unknown}]});
    }
    const candidates=group?catalog.filter(p=>p.kind===kind).map(summary):[];
    return decorate({...base,status:candidates.length?'ambiguous':'unmapped',kind,genericName:oldName?.[0]||({library:'图书馆',dining:'食堂',sports:'体育馆',dorm:'宿舍区'}[kind]),candidates,pendingFloors:parsed});
  }
  const deniedFloors=negativeFloors(text);
  const residual=text.replace(floorUnknownPattern,'').replace(/(?:地下|负)?[一二三四五六七八九十两\d]{1,2}(?:楼|层)|b\d{1,2}|\d{1,2}f/g,'');
  const unknownNamedBuilding=/[a-z\u4e00-\u9fff]{1,20}(?:楼|馆|院|大厦|餐厅|公寓)/.test(residual)||/(?:东|西|南|北)(?:区)?\d{1,3}(?:栋|号楼|楼)?/.test(residual);
  if(prior&&(prior.places?.length||prior.candidates?.length||prior.genericName)&&!unknownNamedBuilding&&(parsed.length||deniedFloors.length||base.floorUnknown||base.detail)){
    if(prior.places?.length===1){
      const p=prior.places[0];
      return decorate({...prior,raw,floorUnknown:base.floorUnknown||(!parsed.length&&prior.floorUnknown),places:[{...p,floors:base.floorUnknown?[]:parsed.length?parsed:p.floors.filter(n=>!deniedFloors.includes(n)),detail:base.detail||p.detail,floorUnknown:base.floorUnknown||(!parsed.length&&p.floorUnknown)}],pendingFloors:[]});
    }
    return decorate({...prior,raw,status:'ambiguous',floorUnknown:base.floorUnknown,pendingFloors:base.floorUnknown?[]:parsed.length?parsed:prior.pendingFloors,detail:base.detail||prior.detail});
  }
  return decorate({...base,pendingFloors:parsed,unmappedName:raw});
}

export function isLocationInquiry(text){
  const s=norm(text);
  const asking=/在哪[里儿]|怎么[去走]|如何[去走]|有几[楼层]|哪个方向/.test(s)||(/(?:是否|是不是)在/.test(s)&&!/不确定|可能|大概|也许/.test(s));
  const declaringLoss=/(?:丢|落|遗失|忘|掉).{0,8}(?:在|到)|(?:在|从).{0,40}(?:丢|落|遗失|忘|掉)/.test(s);
  return asking&&!declaringLoss;
}
// Deterministic preservation for explicitly stated locations, including names
// without a building suffix. This proposes user knowledge, never official facts.
export function unknownLocationMention(value,catalog=CAMPUS_PLACES){
  const raw=String(value||'').normalize('NFKC').trim();
  if(/徐汇|七宝|临港|浦东校区|张江校区|华东师范|华东师大|张江校区|华东师范/.test(raw)||isLocationInquiry(raw))return null;
  const match=raw.match(/(?:丢在|落在|掉在|忘在|遗失在|在|地点[是为:：])\s*[“「"]?([^\s,，。；;：“”"!?！？]{2,60}?)(?=(?:[一二三四五六七八九十两\d]{1,2}(?:楼|层)|\d{1,2}F|丢了|丢失|遗失|掉了|弄丢|落下|忘了|找不到|[，。；;]|$))/i);
  if(!match||/(?:不|不是|并非|没)$/.test(raw.slice(0,match.index)))return null;
  let name=match[1].replace(/(?:的)?(?:门口|入口|出口|靠窗|走廊|附近|旁边|周边|东侧|西侧|南侧|北侧|里面|里边|那里|那边)+$/,'').trim();
  if(name.length<2||name.length>60||/不记得|不知道|不确定|某个|某栋|一个|不是|不在|可能在|或者/.test(name)||/^(?:这里|那里|附近|学校|校内|校园|食堂|餐厅|图书馆|体育馆|教学楼|宿舍|宿舍区|自习室|实验室|楼上|楼下|路上|回去的路上)$/.test(name)||!/[a-z\u3400-\u9fff]/i.test(name))return null;
  if(catalog.some(p=>p.aliases.some(a=>norm(a)===norm(name))))return null;
  // A known location followed only by a room/detail is not a new building.
  if(hitsIn(norm(name),catalog).length)return null;
  const tail=raw.slice(match.index+match[0].length).match(/^(?:[一二三四五六七八九十两\d]{1,2}(?:楼|层)|\d{1,2}F)?(?:靠窗|门口|走廊|附近|旁边)?/i)?.[0]||'';
  return {name,phrase:match[1]+tail};
}

export function locationMention(text,prior=null,catalog=CAMPUS_PLACES){
  const value=norm(text);
  const unknown=unknownLocationMention(text,catalog);
  if(unknown)return /或者|或是|或在|可能|大概|也许|不确定|不记得|记不清/.test(value)?String(text).trim().slice(0,240):unknown.phrase;
  if(isLocationInquiry(value))return undefined;
  if(hitsIn(value,catalog).length||generic.some(([name])=>value.includes(name))||legacy.some(([,aliases])=>aliases.some(a=>value.includes(a)))||/徐汇|七宝|临港|浦东校区|张江校区|华东师范|华东师大/.test(value)||floors(value).length||negativeFloors(value).length||floorUnknownPattern.test(value)||(prior&&detail(value)))return String(text).trim().slice(0,240);
  return undefined;
}

export function lookupCampusPlace(query,catalog=CAMPUS_PLACES){
  const info=resolveCampusLocation(query,null,catalog);
  const ids=new Set([...info.places,...info.candidates].map(p=>p.id));
  return {...info,records:catalog.filter(p=>ids.has(p.id)).map(p=>({...p,source:typeof p.source==='object'?p.source:{...PLACE_SOURCES[p.source],checkedAt:CAMPUS.checkedAt},aliasPolicy:'应用检索变体，需结合上下文',floorsVerified:false})),coordinatesAvailable:false};
}

export function compareCampusLocation(query,found){
  if(!query?.raw||!found?.raw)return null;
  const reasons=[],conflicts=[];let weight=12,gain=0,unresolved=false;
  const common=query.places?.flatMap(q=>(found.places||[]).filter(f=>q.id===f.id).map(f=>({q,f})))||[];
  if(common.length){
    const pair=common.sort((a,b)=>Number(b.q.floors.some(n=>b.f.floors.includes(n)))-Number(a.q.floors.some(n=>a.f.floors.includes(n))))[0];
    const {q,f}=pair;gain=12;
    if(q.relation!=='inside'||f.relation!=='inside'){gain=9;reasons.push('涉及同一建筑或其周边，具体位置待核实');}
    else reasons.push(query.places.length>1?'建筑位于可能范围内':'校园建筑一致');
    if(q.learned||f.learned||q.aliasSource||f.aliasSource)reasons.push('地点或别名来自用户确认补充');
    if(q.floors.length){
      weight+=4;
      if(!f.floors.length){gain+=2;reasons.push('拾获楼层未知');unresolved=true;}
      else if(q.floors.some(n=>f.floors.includes(n))){gain+=4;reasons.push(q.floors.length>1?'楼层位于可能范围内':'楼层一致');}
      else{gain-=2;conflicts.push('楼层不同，保留供核实');}
    }
    if(q.detail&&f.detail){weight+=2;if(q.detail===f.detail){gain+=2;reasons.push('区域描述相符');}else{gain+=0.5;reasons.push('具体区域待核实');}}
  }else if(query.places?.some(q=>found.places?.some(f=>q.parentId===f.id||f.parentId===q.id))){gain=7;unresolved=true;reasons.push('同一楼群或场所范围，具体楼栋待核实');}
  else if(query.places?.length&&found.places?.length){gain=-4;conflicts.push('校园建筑不同');}
  else if(query.kind&&query.kind===found.kind){gain=5;unresolved=true;reasons.push('地点类别相符，具体建筑待确认');}
  else if(norm(query.label)===norm(found.label)){gain=12;reasons.push('地点描述一致（未核实建筑）');}
  else{gain=-4;conflicts.push(query.status==='outside_scope'||found.status==='outside_scope'?'校区范围待核实':'地点描述不同');}
  return {weight,gain,reasons,conflicts,unresolved};
}

export function locationQuestion(criteria,matches=[],catalog=CAMPUS_PLACES){
  const info=criteria.locationInfo||(criteria.location?resolveCampusLocation(criteria.location,null,catalog):null);
  if(!info||info.buildingUnknown)return null;
  if(info.status==='ambiguous'&&info.places.length>1&&info.pendingFloors.length)return {field:'location',text:'你补充的'+info.pendingFloors.map(floorLabel).join('或')+'对应哪一处：'+info.places.map(p=>p.name).join('、')+'？'};
  if(info.status==='ambiguous'&&info.candidates.length)return {field:'location',text:'你说的'+info.genericName+'，具体是'+info.candidates.slice(0,3).map(p=>p.name).join('、')+(info.candidates.length>3?'等哪一处':'中的哪一处')+'？不记得也可以先保留这个范围。'};
  if(!info.places.length&&info.pendingFloors.length&&!info.genericName&&!info.unmappedName)return {field:'location',text:'你说的'+info.pendingFloors.map(floorLabel).join('或')+'是哪一栋楼？'};
  if(info.places.length===1&&!info.floorUnknown&&!info.places[0].floors.length){
    const levels=new Set(matches.flatMap(m=>{const found=m.item.body.locationInfo||resolveCampusLocation(m.item.body.location,null,catalog);return found.places.filter(p=>p.id===info.places[0].id).flatMap(p=>p.floors);}));
    if(levels.size>1)return {field:'location',text:'这些线索在'+info.places[0].name+'的不同楼层。你还记得大概在几楼吗？不记得也没关系。'};
  }
  return null;
}

// Re-resolve saved text against current knowledge; disabled memories cannot survive
// through an old task's cached place ID. Preserve raw input for provenance.
export function refreshLocation(value,info,catalog=CAMPUS_PLACES){
  if(!value)return null;
  const active=new Set(catalog.map(p=>p.id));
  const prior=info?{...info,places:(info.places||[]).filter(p=>active.has(p.id)),candidates:(info.candidates||[]).filter(p=>active.has(p.id))}:null;
  // Old unresolved entries may have a display label containing only a floor.
  // Revisit their original wording once knowledge grows; keep resolved/corrected
  // labels authoritative so later floor corrections are not undone by old raw text.
  const revisit=info?.raw&&info.status!=='resolved'?resolveCampusLocation(info.raw,null,catalog):null;
  const result=revisit?.places?.length?revisit:resolveCampusLocation(value,prior,catalog);
  return {...result,raw:info?.raw||result.raw};
}
