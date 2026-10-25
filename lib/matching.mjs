import {appearanceClues,mergeAppearanceFeatures,featureMatches,sanitizeUnknownParts,APPEARANCE_PARTS,expandSharedUnknownAttributes} from './appearance-clues.mjs';
import {extractTime,compareItemDate,sanitizeDateRange} from './time-clues.mjs';
import {CAMPUS_PLACES,locationMention,refreshLocation,compareCampusLocation,locationQuestion} from './campus-locations.mjs';
export const CATEGORIES = ['水杯','雨伞','耳机','钥匙','书本','文具','数码配件','包袋','其他'];
export const LOCATIONS = [...CAMPUS_PLACES.map(p=>p.name),'图书馆','食堂','体育馆','宿舍区','其他地点','第一教学楼','第二教学楼'];
const types = {水杯:['水杯','保温杯','杯子','水瓶','杯'],雨伞:['雨伞','折叠伞','长柄伞','伞'],耳机:['耳机','airpods'],钥匙:['钥匙','门禁'],书本:['教材','书本','笔记本','课本','高数书','书'],文具:['计算器','笔袋','钢笔','签字笔','文具'],数码配件:['转接头','充电器','充电宝','数据线','u盘','优盘','鼠标'],包袋:['文件袋','书包','背包','钱包','手提袋','帆布包','包袋'],其他:['校园卡','学生卡','饭卡','一卡通']};
const colors = {黑色:['黑色','黑的','黑杯','黑伞'],白色:['白色','白的'],蓝色:['蓝色','蓝的','深蓝'],红色:['红色','红的'],绿色:['绿色','绿的'],灰色:['灰色','灰的'],米色:['米色','米白'],黄色:['黄色','黄的'],粉色:['粉色','粉的'],紫色:['紫色','紫的'],棕色:['棕色','棕的']};
const brands=['象印','膳魔师','富光','小米','华为','苹果','卡西欧','天堂','罗技','anker','airpods','jbl'];
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
export function canonicalColor(value){const s=norm(value);const hits=Object.entries(colors).filter(([name,terms])=>terms.some(t=>s.includes(t))||s===name[0]||new RegExp('^(?:深|浅|藏|墨|荧光)'+name[0]+'$').test(s)).map(([name])=>name);return hits.length===1?hits[0]:String(value||'').trim();}
// Bounded, JSON-only metadata; no schema migration or model-created confidence value.
export function sanitizeClueHints(input){
  const out={};for(const key of ['category','color','brand']){
    const h=input?.[key];if(!h||!['tentative','unknown','excluded'].includes(h.state))continue;
    const options=Array.isArray(h.options)?[...new Set(h.options.filter(v=>typeof v==='string').map(v=>v.trim().slice(0,100)).filter(Boolean))].slice(0,6):[];
    if(h.state==='unknown'||options.length)out[key]={state:h.state,options:h.state==='unknown'?[]:options};
  }return out;
}
export function clueLabel(criteria,key){
  if(key==='date'){if(criteria.dateUnknown)return '记不清，暂不限定';const r=sanitizeDateRange(criteria.dateRange);if(r)return r.start+' 至 '+r.end;}
  const hint=criteria.clueHints?.[key];
  if(hint?.state==='unknown')return '记不清，暂不限定';
  if(hint?.state==='excluded')return (criteria[key]?criteria[key]+'；':'')+'排除：'+hint.options.join('、');
  if(hint?.state==='tentative')return '可能：'+hint.options.join('或');
  return criteria[key]||'尚未确定';
}
export function extract(text, prior={},catalog=CAMPUS_PLACES,now=new Date()) {
  const s=expandSharedUnknownAttributes(norm(text)), patch={},appearance=appearanceClues(s,colors);
  const clueHints=sanitizeClueHints(prior.clueHints);
  for(const [key,dict,label] of [['category',types,'类别|物品种类'],['color',colors,'颜色'],['brand',Object.fromEntries(brands.map(b=>[b,[b]])),'品牌']]) {
    const hits=Object.entries(dict).flatMap(([value,terms])=>terms.flatMap(term=>{
      const positions=[];let at=-1;while((at=s.indexOf(term,at+1))!==-1)positions.push(at);
      return positions.map(at=>({value,term,at}));
    })).filter(h=>!(h.term==='书'&&s.startsWith('书馆',h.at)))
      .filter(h=>key!=='category'||!appearance.partSpans.some(([start,end])=>h.at>=start&&h.at+h.term.length<=end))
      .filter(h=>key!=='color'||!appearance.spans.some(([start,end])=>h.at>=start&&h.at+h.term.length<=end))
      .filter((h,_,all)=>!all.some(o=>o.at<=h.at&&o.at+o.term.length>=h.at+h.term.length&&o.term.length>h.term.length))
      .sort((a,b)=>a.at-b.at);
    const affirmative=hits.filter(h=>!/(?:不是|并非|排除|不要)[^，。；,;]{0,2}$/.test(s.slice(Math.max(0,h.at-5),h.at)));
    const values=[...new Set(affirmative.map(h=>h.value))];
    // Scope uncertainty to a named field or the clause containing that attribute.
    const unknown=new RegExp('(?:'+label+')[^，。；,;]{0,5}(?:不记得|不知道|记不清|不确定|忘了)|(?:不记得|不知道|记不清|不确定|忘了)[^，。；,;]{0,5}(?:'+label+')').test(key==='color'?appearance.primaryText:s);
    if(unknown&&!values.length){patch[key]='';clueHints[key]={state:'unknown',options:[]};continue;}
    if(values.length){
      patch[key]=values.at(-1);delete clueHints[key];
      const tentative=affirmative.some(h=>{
        const before=s.slice(0,h.at).split(/[，。；,;]/).at(-1);
        return (key==='category'?/(?:可能|好像|大概|也许|似乎|不确定|记不清)(?:是|一个|一只|个|的|是个){0,3}$/.test(before):/(?:可能|好像|大概|也许|似乎|不确定|记不清)[^在楼餐馆路区]{0,8}$/.test(before))||/或|还是|要么/.test(s.slice(affirmative[0].at,h.at))||/^(?:的)?(?:也)?(?:不确定|记不清)/.test(s.slice(h.at+h.term.length));
      });
      if(tentative)clueHints[key]={state:'tentative',options:values};
    }else if(hits.length){
      const options=[...new Set(hits.map(h=>h.value))];
      if(options.includes(prior[key]))patch[key]='';
      clueHints[key]={state:'excluded',options};
    }
  }
  if(appearance.clues.length&&patch.color===undefined)patch.color=prior.color||'';
  patch.clueHints=clueHints;
  const mention=locationMention(text,prior.locationInfo||prior.location,catalog);
  if(mention!==undefined)patch.location=mention;
  const shapes=['折叠','长柄','透明','带盖','吸管','圆形','方形','皮革','帆布','贴纸','划痕','挂件'];
  const present=shapes.filter(x=>s.includes(x));
  if(present.length){
    const negative=present.filter(x=>new RegExp('(?:不是|没有|不带|不含|去掉|清除)(?:带|那个|这个)?'+x).test(s));
    patch.feature=[...new Set([...String(prior.feature||'').split('、').filter(Boolean),...present.filter(x=>!negative.includes(x))])].filter(x=>!negative.includes(x)).join('、');
  }
  if(appearance.clues.length||appearance.unknownParts.length)patch.feature=mergeAppearanceFeatures(patch.feature??prior.feature,appearance);
  if(appearance.clues.length||appearance.unknownParts.length){
    const knownParts=appearance.clues.filter(c=>c.state!=='excluded').map(c=>c.part);
    patch.appearanceUnknownParts=sanitizeUnknownParts([...sanitizeUnknownParts(prior.appearanceUnknownParts).filter(p=>!knownParts.includes(p)),...appearance.unknownParts]);
  }
  if(/(?:外观|特征)[^，。；,;]{0,4}(?:不记得|记不清|清空)/.test(s)){patch.feature='';patch.appearanceUnknownParts=sanitizeUnknownParts(APPEARANCE_PARTS);}
  if(/不记得|不知道|记不清|不确定/.test(s)) patch.uncertain=true;
  Object.assign(patch,extractTime(text,now));
  const result={...prior,...patch};
  if(patch.location!==undefined&&patch.location!==prior.location)delete result.locationInfo;
  return result;
}
export function rank(criteria, items, excluded=[],catalog=CAMPUS_PLACES) {
  const queryLocation=refreshLocation(criteria.location,criteria.locationInfo,catalog);
  return items.filter(i=>i.body.status==='available'&&!excluded.includes(i.id)).map(item=> {
    if(item.body.location){const locationInfo=refreshLocation(item.body.location,item.body.locationInfo,catalog);item={...item,body:{...item.body,locationInfo,location:locationInfo.label}};}
    const b=item.body, reasons=[], conflicts=[], pending=[];let score=0,weight=0,matchedFields=0;
    const hints=sanitizeClueHints(criteria.clueHints);
    let rejected=false;
    const compare=(key,w,label)=>{
      const hint=hints[key];
      if(hint?.state==='excluded'){if(hint.options.some(v=>norm(key==='color'?canonicalColor(v):v)===norm(key==='color'?canonicalColor(b[key]):b[key])))rejected=true;if(!criteria[key])return;}
      if(hint?.state==='unknown'||!criteria[key]&&!hint)return;
      weight+=w;
      if(!b[key]){pending.push('拾获记录未登记'+label);return;}
      const normalized=v=>norm(key==='color'?canonicalColor(v):v);
      const same=hint?.state==='tentative'?hint.options.some(v=>normalized(v)===normalized(b[key])):normalized(criteria[key])===normalized(b[key]);
      if(same){score+=w*(hint?.state==='tentative'?0.8:1);matchedFields++;reasons.push(label+(hint?.state==='tentative'?'符合可能范围':'一致'));}
      else if(hint?.state==='tentative'){score-=w*0.2;conflicts.push(label+'与暂记线索不同（用户尚未确定）');}
      else rejected=true;
    };
    compare('category',40,'物品类别');compare('color',20,'颜色');compare('brand',18,'品牌');
    if(rejected)return null;
    const placeMatch=queryLocation&&b.location?compareCampusLocation(queryLocation,b.locationInfo):null;
    if(placeMatch){weight+=placeMatch.weight;score+=placeMatch.gain;if(placeMatch.gain>0)matchedFields++;reasons.push(...placeMatch.reasons);conflicts.push(...placeMatch.conflicts);if(placeMatch.unresolved)pending.push('地点范围仍待核对');}
    else if(criteria.location){weight+=12;pending.push('拾获记录未登记地点');}
    if(criteria.feature) {
      const features=[...new Set(String(criteria.feature).split(/[、，,；;]+/).map(norm).filter(Boolean))].slice(0,8);
      weight+=10;const found=features.filter(f=>featureMatches(f,b.description,colors));
      score+=10*found.length/Math.max(1,features.length);
      if(found.length){matchedFields++;reasons.push('外观相符：'+found.join('、'));}
      if(features.some(f=>f.startsWith('可能：')))pending.push('部分外观线索尚未确定');
      if(found.length<features.length)pending.push('外观待核实：'+features.filter(f=>!found.includes(f)).join('、'));
    }
    const time=compareItemDate(criteria,b.date);
    if(time){weight+=8;score+=time.gain;if(time.reason){matchedFields++;reasons.push(time.reason);}if(time.pending)pending.push(time.pending);if(time.conflict)conflicts.push(time.conflict);}
    if(criteria.imageHash&&b.imageHash){let n=0;try{let x=BigInt('0x'+criteria.imageHash)^BigInt('0x'+b.imageHash);while(x){n+=Number(x&1n);x>>=1n;}weight+=4;score+=4*(1-n/64);reasons.push('照片外观仅作辅助');}catch{}}
    const relevance=weight?Math.round(Math.max(0,score/weight)*100):0;
    return {item,score:relevance,reasons,conflicts,pending,matchedFields,unknown:['brand','color','location'].filter(k=>!criteria[k]||!b[k]||(k==='location'&&placeMatch?.unresolved))};
  }).filter(m=>m&&m.score>=25).sort((a,b)=>b.score-a.score||b.matchedFields-a.matchedFields||String(a.item.id).localeCompare(String(b.item.id))).slice(0,6);
}
export function nextQuestion(criteria,matches,catalog=CAMPUS_PLACES) {
  if(!criteria.category&&criteria.clueHints?.category?.state!=='unknown') return {field:'category',text:'你丢的主要是什么物品？例如水杯、耳机、钥匙或包袋。'};
  const placeQuestion=locationQuestion(criteria,matches,catalog);if(placeQuestion)return placeQuestion;
  if(criteria.uncertain&&!criteria.clueHints)return null; // Old stored tasks had only a global unknown flag.
  if(matches.length>1){
    const choices=[];
    for(const [key,label] of [['brand','品牌'],['color','颜色']]){
      if(criteria[key]&&criteria.clueHints?.[key]?.state!=='tentative'||criteria.clueHints?.[key]?.state==='unknown')continue;
      const counts=new Map();for(const m of matches){const value=key==='color'?canonicalColor(m.item.body[key]):m.item.body[key];if(value)counts.set(value,(counts.get(value)||0)+1);}
      if(counts.size<2)continue;
      const known=[...counts.values()].reduce((a,b)=>a+b,0);
      const entropy=[...counts.values()].reduce((sum,n)=>sum-n/known*Math.log2(n/known),0);
      choices.push({field:key,label,utility:entropy*known/matches.length,knownCandidates:known,options:[...counts.keys()].slice(0,4),prompt:value=>label+'是'+value,unknownPrompt:label+'记不清了'});
    }
    const current=appearanceClues(criteria.feature,colors),forgotten=sanitizeUnknownParts(criteria.appearanceUnknownParts);
    const parts=new Map();
    for(const m of matches){
      const clues=appearanceClues(m.item.body.description,colors),perPart=new Map();
      for(const c of clues.clues)if(c.state==='known'&&!clues.unknownParts.includes(c.part)){if(!perPart.has(c.part))perPart.set(c.part,new Set());perPart.get(c.part).add(c.color);}
      for(const [part,values] of perPart){
        if(values.size!==1||forgotten.includes(part)||current.clues.some(c=>c.part===part&&c.state==='known'))continue;
        if(!parts.has(part))parts.set(part,new Map());const value=[...values][0],counts=parts.get(part);counts.set(value,(counts.get(value)||0)+1);
      }
    }
    for(const [part,counts] of parts){
      if(counts.size<2)continue;
      const known=[...counts.values()].reduce((a,b)=>a+b,0),entropy=[...counts.values()].reduce((sum,n)=>sum-n/known*Math.log2(n/known),0);
      choices.push({field:'partColor:'+part,label:part+'颜色',utility:entropy*known/matches.length,knownCandidates:known,options:[...counts.keys()].slice(0,4),prompt:value=>part+'是'+value,unknownPrompt:part+'颜色记不清了'});
    }
    choices.sort((a,b)=>b.utility-a.utility||b.knownCandidates-a.knownCandidates||a.field.localeCompare(b.field));
    if(choices.length){const best=choices[0];return {field:best.field,strategy:'candidate-information-gain',knownCandidates:best.knownCandidates,totalCandidates:matches.length,text:'候选记录的'+best.label+'有'+best.options.join('、')+'。你能确认'+best.label+'吗？记不清也可以保留范围继续找。',answerOptions:[...best.options.map(value=>({label:value,prompt:best.prompt(value)})),{label:'记不清',prompt:best.unknownPrompt}]};}
  }
  return null;
}
export function publicItem(item) {
  const {privateNote,contact,...body}=item.body;
  return {id:item.id,owner:item.owner,created:item.created,updated:item.updated,body};
}
