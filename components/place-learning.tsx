'use client';
import {useEffect,useState} from 'react';
import {PLACE_KINDS} from '../lib/place-learning.mjs';
type Action=(path:string,body:any)=>Promise<any>;

export function PlaceLearningCard({proposal,busy,onAction}:{proposal:any;busy:boolean;onAction:Action}){
  const [name,setName]=useState(proposal.name),[aliases,setAliases]=useState((proposal.aliases||[]).join('、')),[note,setNote]=useState(proposal.note||''),[kind,setKind]=useState(proposal.kind||'other');
  useEffect(()=>{setName(proposal.name);setAliases((proposal.aliases||[]).join('、'));setNote(proposal.note||'');setKind(proposal.kind||'other');},[proposal.id,proposal.version]);
  if(proposal.status!=='pending')return <div className="learning-card settled"><strong>{proposal.status==='confirmed'?'已记住这个地点':proposal.status==='rejected'?'本次地点学习已取消':'这条学习请求暂不可用'}</strong><p>{proposal.name}{proposal.aliases?.length?' · '+proposal.aliases.join('、'):''}</p></div>;
  return <section className="learning-card" aria-label="待确认的地点学习">
    <strong>{proposal.type==='alias'?'补充已有地点的别名':'学习一个新地点'}</strong>
    <p>核对后保存到当前校园空间，之后可用于名称识别与物品匹配。信息标记为用户补充，未经校方核实。</p>
    <label>地点名称<input value={name} onChange={e=>setName(e.target.value)} maxLength={60}/></label>
    <label>别名或简称<input value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="多个称呼用顿号分隔" maxLength={200}/></label>
    <label>地点类别<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(PLACE_KINDS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label>位置说明（可选）<input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：东中院旁边；不会据此生成坐标" maxLength={240}/></label>
    <div className="learning-actions"><button className="button primary" disabled={busy||!name.trim()} onClick={()=>onAction('places/confirm',{id:proposal.id,version:proposal.version,name,aliases,kind,note}).catch(()=>{})}>确认并记住</button><button className="button outlined" disabled={busy} onClick={()=>onAction('places/reject',{id:proposal.id}).catch(()=>{})}>暂不记住</button></div>
  </section>;
}

export function PlaceMemoryPanel({knowledge,initialName='',busy,onAction}:{knowledge:any;initialName?:string;busy:boolean;onAction:Action}){
  const [name,setName]=useState(initialName),[aliases,setAliases]=useState(''),[note,setNote]=useState(''),[error,setError]=useState('');
  const propose=async(e:React.FormEvent)=>{e.preventDefault();setError('');try{const result=await onAction('places/propose',{name,aliases,note});if(result.status==='known')setError('这个名称或别名已经在地点库中。');else{setName('');setAliases('');setNote('');}}catch(e:any){setError(e.message);}};
  return <div className="modal-body place-memory-panel"><p>内置 {knowledge?.builtinCount||0} 处闵行校区地点。可以直接在寻物对话里教我：“记住一个新地点：星禾自习室，简称星窝。”也可以在这里补充。确认后会持久保存，刷新后仍可使用。</p>
    <form onSubmit={propose} className="learning-form"><label>新地点或已有地点名<input value={name} onChange={e=>setName(e.target.value)} placeholder="填写具体建筑或区域，不填楼层" maxLength={60} required/></label><label>新别名（可选）<input value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="例如：星窝" maxLength={200}/></label><label>位置说明（可选）<input value={note} onChange={e=>setNote(e.target.value)} maxLength={240}/></label><button className="button outlined" disabled={busy||!name.trim()}>整理学习草稿</button>{error&&<p className="inline-warning">{error}</p>}</form>
    {knowledge?.proposals?.map((p:any)=><PlaceLearningCard key={p.id} proposal={p} busy={busy} onAction={onAction}/>)}
    {!!knowledge?.observations?.length&&<><h3>新地点原话记录</h3><p className="inline-note">原话在当前空间保存。确认后的名称可跨对话识别；用户补充不代表校方核实。</p>{knowledge.observations.map((o:any)=><article className="place-memory-row" key={o.id}><strong>{o.raw}</strong><small>{o.recognitionStatus==='resolved'?'已可识别 · 查看下方记忆及来源':'用户提供 · 待核对'}</small><button className="text-button" disabled={busy||o.recognitionStatus==='resolved'} onClick={()=>{setName(o.candidateName||o.raw);setNote('');setAliases('');}}>填入上方表单核对</button></article>)}</>}
    <h3>已学会的地点与别名</h3>
    {!knowledge?.memories?.length&&<p className="inline-note">还没有用户补充的记忆，原有校园地点库不受影响。</p>}
    {knowledge?.memories?.map((m:any)=><article className="place-memory-row" key={m.id}><strong>{m.name}{m.type==='alias'?' · 补充别名':''}</strong><p>{m.aliases?.join('、')||'按名称识别'}{m.note?' · '+m.note:''}</p><small>{m.status==='active'?'使用中':'已停用'} · 用户确认补充，未经校方核实</small>{m.canManage&&<button className="text-button" disabled={busy} onClick={()=>onAction('places/memory/action',{id:m.id,active:m.status!=='active',version:m.version}).catch(()=>{})}>{m.status==='active'?'停用这条记忆':'恢复这条记忆'}</button>}</article>)}
  </div>;
}
