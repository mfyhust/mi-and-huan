'use client';
type Suggestion={field:string;explanation:string;actionText:string;prompt:string};
type Diagnosis={status:string;summary:string;suggestions:Suggestion[]};
export function SearchGuidance({diagnosis,disabled,historical=false,onAction}:{diagnosis?:Diagnosis;disabled:boolean;historical?:boolean;onAction:(text:string)=>void}){
 if(!diagnosis||diagnosis.status==='matches')return null;
 return <section className="search-guidance" aria-label="未找到候选的原因与下一步"><strong>下一步怎么找</strong><p>{diagnosis.summary}</p>{diagnosis.suggestions?.map(s=><div key={s.field}><p>{s.explanation}</p><button className="text-button" disabled={disabled} onClick={()=>onAction(s.prompt)}>{s.actionText}</button></div>)}{diagnosis.suggestions?.length>0&&<small>仅在这项确实记不准时修改；条件确认无误可继续留意。最终认领仍需保管人核实。</small>}{historical&&<small>历史诊断仅供回看，请按当前条件重新查询。</small>}</section>;
}
