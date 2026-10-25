'use client';
import {resolveCampusLocation,floorLabel} from '../lib/campus-locations.mjs';

type Props={value:string;locations:string[];places?:any[];onLearn?:()=>void;onChange:(value:string)=>void};
export function CampusLocationField({value,locations,places,onLearn,onChange}:Props){
  const info=resolveCampusLocation(value,null,places);
  const choose=(name:string)=>onChange(name+info.pendingFloors.map(floorLabel).join('或')+(info.detail?' '+info.detail:''));
  return <div className="campus-location-field"><label htmlFor="found-campus-location">拾获地点 *</label>
    <input id="found-campus-location" required list="campus-place-options" value={value} onChange={e=>onChange(e.target.value)} placeholder="例如：五餐二楼靠窗、东中院三楼" maxLength={100}/>
    <datalist id="campus-place-options">{locations.map(name=><option key={name} value={name}/>)}</datalist>
    {value&&<span className="location-preview">
      <strong>{info.status==='resolved'?'已识别：'+info.label:info.status==='ambiguous'?'具体建筑待确认':info.status==='outside_scope'?'当前地点库只覆盖闵行校区':'未收录为具体建筑，将按原文保存'}</strong>
      {info.status==='resolved'&&<small>{info.places.some((p:any)=>p.learned||p.aliasSource)?'用户确认补充的地点或别名 · ':'闵行校区 · '}楼层与区域按你的描述保存</small>}
      {info.status==='unmapped'&&onLearn&&<button type="button" className="text-button" onClick={onLearn}>教助手记住这个地点</button>}
      {info.status==='ambiguous'&&info.candidates.length>0&&<span className="place-choices">{info.candidates.slice(0,9).map((p:any)=><button type="button" key={p.id} onClick={()=>choose(p.name)}>{p.name}</button>)}</span>}
    </span>}
  </div>;
}
