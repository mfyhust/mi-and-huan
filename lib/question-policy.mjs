import {APPEARANCE_PARTS,sanitizeUnknownParts} from './appearance-clues.mjs';
// Validate only clearly named attributes. Unrelated useful questions remain model choices.
export function checkClarification(question,criteria={}){
 const text=String(question||'').trim();if(!text)return {allowed:false,code:'QUESTION_EMPTY',error:'追问不能为空。'};
 const colorQuestion=/颜色|什么色|哪种色|配色/.test(text),parts=sanitizeUnknownParts(APPEARANCE_PARTS.filter(p=>text.includes(p)));
 const fields=[];
 if(colorQuestion&&parts.length){for(const part of parts){const forgotten=sanitizeUnknownParts(criteria.appearanceUnknownParts).includes(part),known=String(criteria.feature||'').split('、').some(t=>!/^可能[:：]/.test(t)&&t.endsWith(part)&&t.includes('色'));fields.push({field:'partColor:'+part,label:part+'颜色',forgotten,known});}}
 else if(colorQuestion)fields.push({field:'color',label:'主体颜色'});
 if(/品牌|牌子|什么牌/.test(text))fields.push({field:'brand',label:'品牌'});
 if(/物品(?:类别|种类)|什么(?:物品|东西)|丢的是什么|找的是什么/.test(text))fields.push({field:'category',label:'物品类别'});
 if(/日期|哪天|几号|什么时候/.test(text))fields.push({field:'date',label:'遗失日期',forgotten:!!criteria.dateUnknown,known:!!(criteria.date||criteria.dateRange?.start||criteria.dateRange?.end)&&!criteria.dateUnknown});
 for(const f of fields){
  const hint=criteria.clueHints?.[f.field];
  const forgotten=f.forgotten??(hint?.state==='unknown'||criteria.uncertain&&!criteria.clueHints);
  const known=f.known??(!!criteria[f.field]&&hint?.state!=='tentative'&&hint?.state!=='unknown');
  if(forgotten)return {allowed:false,code:'QUESTION_FORGOTTEN',field:f.field,error:'用户已说'+f.label+'记不清，不能重复要求回答；可继续按其余线索寻找。'};
  if(known)return {allowed:false,code:'QUESTION_KNOWN',field:f.field,error:f.label+'已确认，无需重复询问；如用户主动更正再更新。'};
 }
 if(fields.length>1)return {allowed:false,code:'QUESTION_MULTIPLE_FIELDS',error:'每轮只追问一个会影响寻找的属性。'};
 return {allowed:true};
}

// A final answer is not a tool call. Inspect only explicit requests/questions,
// so descriptions of known facts and checking a candidate are not suppressed.
export function checkReplyClarifications(reply,criteria={}){
 for(const sentence of String(reply||'').match(/[^。！？?!；;\n]+[。！？?!；;\n]?/g)||[]){
  if(!/[？?]|是什么|什么颜色|什么牌|哪种颜色|哪天|几号|什么时候|请(?:再)?(?:告诉|补充|提供)/.test(sentence))continue;
  if(/(?:核对|查看|检查).*(?:候选|拾获记录)|(?:候选|拾获记录).*(?:核对|查看|检查)/.test(sentence))continue;
  const checked=checkClarification(sentence,criteria);
  if(!checked.allowed)return checked;
 }
 return {allowed:true};
}
