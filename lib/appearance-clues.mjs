// Small, explicit Chinese part/colour bindings. These are soft visual clues,
// never identity proof or a reason to silently overwrite the main item colour.
export const APPEARANCE_PARTS=Object.freeze(['杯盖','盖子','杯底','吸管','伞柄','伞套','手柄','挂件','贴纸','图案','背带','拉链','钥匙扣','保护套','耳机盒']);
const PARTS=APPEARANCE_PARTS;
const canonPart=p=>p==='盖子'?'杯盖':p;
export const sanitizeUnknownParts=value=>Array.isArray(value)?[...new Set(value.filter(p=>PARTS.includes(p)).map(canonPart))]:[];
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Expand only explicit, bounded lists sharing an unknown predicate. This text
// is used for attribute parsing; original location/provenance text stays intact.
export function expandSharedUnknownAttributes(text){
 const attribute='(?:品牌|牌子|主体颜色|杯身颜色|物品颜色|颜色|物品类别|类别|(?:'+PARTS.join('|')+')(?:的颜色|颜色)?)';
 const group=new RegExp('('+attribute+'(?:[、和与及]'+attribute+'){1,3})(?:都|均)?(?:仍然|还是|依然)?(不记得|记不清|不知道|不确定|忘了)','g');
 return String(text).replace(group,(whole,list,predicate,at,source)=>{
  if(/(?:不是|并非|不是说|不能说|别以为|不要认为)$/.test(source.slice(Math.max(0,at-8),at)))return whole;
  return list.split(/[、和与及]/).map(label=>(label==='牌子'?'品牌':label)+predicate).join('，');
 });
}
export function appearanceClues(text,colors){
 const s=String(text||'').toLowerCase().replace(/\s+/g,''),terms=Object.entries(colors).flatMap(([color,aliases])=>aliases.map(term=>({term,color}))).sort((a,b)=>b.term.length-a.term.length);
 const colorOf=new Map(terms.map(t=>[t.term,t.color])),pattern=terms.map(t=>escaped(t.term)).join('|'),parts=PARTS.join('|');
 const clues=[],spans=[],partSpans=[];
 const state=(start,end)=>{const before=s.slice(Math.max(0,start-9),start),after=s.slice(end,end+7);return /(?:不是|并非|没有|不带|不含)(?:一个|那个|的)?$/.test(before)?'excluded':/(?:可能|好像|也许|大概|不确定)(?:是|为|的|[:：])?$/.test(before)||/^(?:也)?(?:不确定|记不清)/.test(after)?'tentative':'known';};
 for(const m of s.matchAll(new RegExp('('+pattern+')(?:的)?('+parts+')','g'))){const start=m.index,end=start+m[0].length;clues.push({part:canonPart(m[2]),color:colorOf.get(m[1]),state:state(start,end)});spans.push([start,start+m[1].length]);partSpans.push([start,end]);}
 for(const m of s.matchAll(new RegExp('('+parts+')(?:的颜色|颜色)?(?:可能是|好像是|不是|并非|是|为|呈|的)?('+pattern+')','g'))){const start=m.index,end=start+m[0].length,colorStart=end-m[2].length;clues.push({part:canonPart(m[1]),color:colorOf.get(m[2]),state:/不是|并非/.test(m[0])?'excluded':/可能|好像/.test(m[0])?'tentative':state(start,end)});spans.push([colorStart,end]);partSpans.push([start,end]);}
 // Bind omitted subjects only in explicit, adjacent corrections. A following
 // named subject (e.g. red cup body) must not be reassigned to the previous part.
 const corrections=[
   {pattern:new RegExp('('+parts+')(?:的颜色|颜色)?(?:不是|并非)('+pattern+')[，,](?:其实|应该|应当)?((?:可能|好像|也许)?)(?:是|为)('+pattern+')(?=$|[，,。；;！!？?])','g'),part:1,color:4,tentative:3},
   {pattern:new RegExp('('+pattern+')(?:的)?('+parts+')[，,]不对[，,]((?:可能|好像|也许)?)(?:是|为)('+pattern+')(?=$|[，,。；;！!？?])','g'),part:2,color:4,tentative:3}
 ];
 for(const rule of corrections)for(const m of s.matchAll(rule.pattern)){
   const part=canonPart(m[rule.part]),start=m.index,end=start+m[0].length;
   for(const c of clues)if(c.part===part)c.state='excluded';
   clues.push({part,color:colorOf.get(m[rule.color]),state:m[rule.tentative]?'tentative':'known'});
   const colorStart=end-m[rule.color].length;spans.push([colorStart,end]);partSpans.push([start,end]);
 }
 const unknownPattern=new RegExp('(?:'+parts+')(?:的颜色|颜色)?(?:我)?(?:仍然|还是|依然|也|已经)?(?:不记得|记不清|不知道|不确定|忘了)|(?:不记得|记不清|不知道)(?:'+parts+')(?:的颜色|颜色)','g');
 const unknownMatches=[...s.matchAll(unknownPattern)],unknownParts=PARTS.filter(p=>unknownMatches.some(m=>m[0].includes(p))).map(canonPart);
 const primaryText=s.replace(unknownPattern,'');
 return {clues:[...new Map(clues.map(c=>[c.part+':'+c.color+':'+c.state,c])).values()],unknownParts,spans,partSpans,primaryText};
}
export function mergeAppearanceFeatures(feature,appearance){
 let terms=String(feature||'').split('、').filter(Boolean);
 for(const part of new Set([...appearance.clues.map(c=>c.part),...appearance.unknownParts]))terms=terms.filter(t=>!t.endsWith(part)||!/(?:黑|白|蓝|红|绿|灰|米|黄|粉|紫|棕)色/.test(t));
 for(const c of appearance.clues)if(c.state!=='excluded'&&!appearance.unknownParts.includes(c.part))terms.push((c.state==='tentative'?'可能：':'')+c.color+c.part);
 return [...new Set(terms)].join('、');
}
export function featureMatches(feature,description,colors){
 const term=String(feature).replace(/^可能[:：]/,''),s=String(description||'').toLowerCase().replace(/\s+/g,'');
 if(s.includes(term)){
  const at=s.indexOf(term),before=s.slice(Math.max(0,at-6),at);if(!/(?:没有|不是|不带|无)(?:的)?$/.test(before))return true;
 }
 if(!PARTS.some(p=>term.endsWith(p))||!term.includes('色'))return false;
 return appearanceClues(description,colors).clues.some(c=>c.state!=='excluded'&&c.color+c.part===term);
}
