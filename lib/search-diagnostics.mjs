import {rank,sanitizeClueHints} from './matching.mjs';
// Read-only counterfactuals: neither loosen live criteria nor return excluded items.
export function diagnoseSearch(criteria,items,excluded=[],catalog,matches){
  const available=items.filter(i=>i.body.status==='available'),excludedIds=new Set(excluded);
  const eligible=available.filter(i=>!excludedIds.has(i.id));
  const current=matches||rank(criteria,items,excluded,catalog);
  const base={scope:'current-workspace-records',availableRecords:available.length,excludedRecords:available.length-eligible.length,suggestions:[],changesApplied:false};
  if(current.length)return {...base,status:'matches',summary:'当前已有候选，请先核对公开特征。'};
  if(!available.length)return {...base,status:'no_records',summary:'当前工作区还没有可认领的拾获记录；这不代表校园里没人捡到。'};
  if(!eligible.length)return {...base,status:'all_excluded',summary:'当前可认领记录均已被你排除。若曾误排除，可到任务条件中恢复；否则可持续留意。'};
  const hints=sanitizeClueHints(criteria.clueHints);
  if(criteria.category&&!hints.category&&!eligible.some(i=>i.body.category===criteria.category)){
    if(available.some(i=>i.body.category===criteria.category))return {...base,status:'category_excluded',summary:'当前同类可认领线索已被你排除。若曾误排除，可在任务条件中恢复；其他类别不作为替代推荐。'};
    return {...base,status:'no_category',summary:'当前未排除记录中还没有这个类别的物品，可保留条件持续留意。'};
  }
  const suggestions=[];
  for(const [field,label] of [['color','颜色'],['brand','品牌']]){
    if(!criteria[field]||hints[field])continue;
    const alternative={...criteria,[field]:'',clueHints:{...hints}};
    const found=rank(alternative,eligible,[],catalog);
    if(!found.length)continue;
    suggestions.push({field,label,candidateCount:found.length,atLeast:found.length===6,
      explanation:'仅解除'+label+'条件、保留其余条件，可得到'+(found.length===6?'至少':'')+found.length+'条初筛线索。',
      actionText:label+'记不清，重新查找',prompt:label+'不记得了，请保留其余条件重新查询。'});
  }
  suggestions.sort((a,b)=>b.candidateCount-a.candidateCount||a.field.localeCompare(b.field));
  if(suggestions.length)return {...base,status:'criteria_blocked',summary:'部分记录与已确认条件有差异。请先核对'+suggestions.map(s=>s.label).join('、')+'，目前没有修改你的条件。',suggestions};
  return {...base,status:'no_match',summary:'保留当前条件未找到合适记录；可能尚未收录或有多项差异，不宜直接认定是哪一项记错了。'};
}
