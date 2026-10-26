'use client';
import {useId,useState} from 'react';
import {resolveCampusLocation,floorLabel} from '../lib/campus-locations.mjs';

type Props={value:string;locations:string[];places?:any[];label?:string;onLearn?:()=>void;onChange:(value:string)=>void};
const mainKinds=[['dining','食堂餐饮'],['library','图书馆'],['teaching','教学科研'],['sports','体育场馆'],['dorm','宿舍'],['gate','校门'],['road','道路'],['service','生活服务'],['medical','医疗'],['culture','文化场所'],['landscape','景观'],['admin','办公场所']] as const;
export function CampusLocationField({value,locations,places,label='拾获地点（可选）',onLearn,onChange}:Props){
  const [other,setOther]=useState(false);
  const id=useId(),info=resolveCampusLocation(value,null,places),catalog=places||[];
  const choose=(name:string)=>onChange(name+info.pendingFloors.map(floorLabel).join('或')+(info.detail?' '+info.detail:''));
  return <div className="campus-location-field"><label htmlFor={id}>{label}</label>
    <select aria-label={label+'快捷选择'} value={other&&!value?'other':catalog.some(p=>p.name===value)?value:info.status==='resolved'&&info.places.length===1?info.places[0].name:value?'other':''} onChange={e=>{setOther(e.target.value==='other');onChange(e.target.value==='other'?'':e.target.value);}}><option value="">暂不填写 / 记不清</option>{mainKinds.map(([kind,title])=><optgroup key={kind} label={title}>{catalog.filter(p=>p.kind===kind).slice(0,kind==='dorm'?12:20).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</optgroup>)}<option value="other">其他地点（自由填写）</option></select>
    <input id={id} list={id+'-options'} value={value} onChange={e=>onChange(e.target.value)} placeholder="可留空，或补充五餐二楼靠窗等位置" maxLength={100}/>
    <datalist id={id+'-options'}>{locations.map(name=><option key={name} value={name}/>)}</datalist>
    <small>不记得可以留空；主要地点可快捷选择，其他地点直接输入。</small>
    {value&&<span className="location-preview">
      <strong>{info.status==='resolved'?'已识别：'+info.label:info.status==='ambiguous'?'具体建筑待确认（可不选）':info.status==='outside_scope'?'当前地点库只覆盖闵行校区':'未收录为具体建筑，将按原文保存'}</strong>
      {info.status==='resolved'&&<small>{info.places.some((p:any)=>p.learned||p.aliasSource)?'用户确认补充的地点或别名 · ':'闵行校区 · '}楼层与区域按你的描述保存</small>}
      {info.status==='unmapped'&&onLearn&&<button type="button" className="text-button" onClick={onLearn}>教助手记住这个地点</button>}
      {info.status==='ambiguous'&&info.candidates.length>0&&<span className="place-choices">{info.candidates.slice(0,9).map((p:any)=><button type="button" key={p.id} onClick={()=>choose(p.name)}>{p.name}</button>)}</span>}
    </span>}
  </div>;
}
