'use client';
type Clarification={text:string;answerOptions?:{label:string;prompt:string}[]};
export function CandidateQuestion({suggestion,disabled,onChoose}:{suggestion?:Clarification;disabled:boolean;onChoose:(text:string)=>void}){
 if(!suggestion?.answerOptions?.length)return null;
 return <section className="candidate-question" aria-label="核对候选差异"><strong>再核对一个细节</strong><p>{suggestion.text}</p><div>{suggestion.answerOptions.map(option=><button type="button" className="button outlined" key={option.prompt} disabled={disabled} onClick={()=>onChoose(option.prompt)}>{option.label}</button>)}</div><small>选择后仅填写到输入框，可修改后发送；这些差异不能证明物品归属。</small></section>;
}
