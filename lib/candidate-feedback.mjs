// Conservative authorization for model-requested feedback. UI feedback retains
// its explicit per-card action; an uncertain conversation must not change it.
const norm=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'');
export function candidateFeedbackIntent(text){
  const s=norm(text);
  if(/(?:不要|不用|别|先不|暂不|不想|不需要|没让|没叫|没说|没有要求|不是要|不是说要)[^，。；,]{0,14}(?:排除|移除|去掉|恢复|撤销)/.test(s))return null;
  if(/(?:怎么|如何|是否|要不要)[^，。；,]{0,14}(?:排除|恢复|撤销)/.test(s)||/(?:如果|假设|举例|印着|写着|写的是|上面写)[^。；]{0,35}(?:排除|不是我的|恢复)/.test(s))return null;
  if(/(?:排除|恢复|撤销)[^。；]{0,18}(?:是什么意思|会怎样|会怎么样)/.test(s))return null;
  const restore=/恢复|撤销[^，。；,]{0,6}排除|重新[^，。；,]{0,6}(?:候选|线索)/.test(s);
  const reject=/排除|移除[^，。；,]{0,4}(?:候选|线索)|去掉[^，。；,]{0,4}(?:候选|线索)|不是(?:我的|我丢的|这件|这条|这个)|不属于我|(?:这条|这个|这件|第[一二三四五六七八九十两\d]+[条个件])[^，。；,]{0,8}(?:不对|不符合|不吻合)/.test(s);
  return restore?'restore':reject?'reject':null;
}

const ordinal=value=>{
  if(/^\d+$/.test(value))return Number(value);
  const digit={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
  if(value==='十')return 10;
  if(value.length===1)return digit[value];
  const parts=value.split('十');
  if(parts.length===2)return (parts[0]?digit[parts[0]]:1)*10+(parts[1]?digit[parts[1]]:0);
  return NaN;
};
const publicCandidate=(item,index)=>({number:index+1,id:item.id,title:item.body.title,category:item.body.category,color:item.body.color,brand:item.body.brand,location:item.body.location,status:item.body.status});

export async function candidateFeedbackContext(service,task){
  const messages=(await service.store.list('message')).filter(m=>m.owner===service.actor&&m.body.taskId===task.id&&m.body.role==='assistant').sort((a,b)=>b.created.localeCompare(a.created));
  const ids=messages[0]?.body.candidateIds||[];
  const items=new Map((await service.store.list('item')).map(item=>[item.id,item]));
  const displayed=ids.slice(0,6).flatMap(id=>items.has(id)?[items.get(id)]:[]).map(publicCandidate);
  const excluded=(await service.exclusions(task)).slice(0,6).map(e=>e.item).map(publicCandidate);
  return {displayed,excluded,notice:'displayed按最近一轮候选卡片编号；excluded单独编号。只在用户明确要求且对象唯一时操作，否则追问。'};
}

export function candidateFeedbackRequest(text,context){
  const intent=candidateFeedbackIntent(text);
  if(!intent)return null;
  const restore=intent==='restore';
  const candidates=restore?context.excluded:context.displayed;
  const s=norm(text);
  const numbers=[...new Set([...s.matchAll(/第([\d一二三四五六七八九十两]+)(?:条|个|件)/g)].map(m=>ordinal(m[1])))];
  let targets;
  if(numbers.length){
    if(numbers.length!==1)return {error:'请一次明确一条候选，或在对应卡片上操作。'};
    targets=candidates.filter(c=>c.number===numbers[0]);
  }else{
    targets=candidates.filter(c=>s.includes(c.id));
    if(!targets.length)targets=candidates.filter(c=>c.title?.length>=2&&s.includes(norm(c.title)));
    if(!targets.length&&candidates.length===1)targets=candidates;
  }
  if(targets?.length!==1)return {error:'当前对象不明确，请说明第几条或物品标题，暂不修改候选。'};
  return {itemId:targets[0].id,restore};
}

export function authorizeCandidateFeedback(text,{itemId,restore=false},context){
  const expected=restore?'restore':'reject';
  if(candidateFeedbackIntent(text)!==expected)return {error:restore?'用户尚未明确要求恢复候选，请先确认。':'用户尚未明确要求排除候选，或明确要求暂不操作。'};
  const candidates=restore?context.excluded:context.displayed;
  if(!candidates.some(c=>c.id===itemId))return {error:restore?'只能恢复当前任务中已排除的候选。':'只能排除最近一轮实际展示的候选。'};
  const request=candidateFeedbackRequest(text,context);
  if(request.error)return request;
  if(request.itemId!==itemId)return {error:'工具选择与用户指定的候选不一致，暂不修改。'};
  return {ok:true};
}
