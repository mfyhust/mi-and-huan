'use client';
import {useState} from 'react';
type Settings={provider:string;model:string;key:string;source?:string};
type Props={info:any;value:Settings;onChange:(value:Settings)=>void;onApply:()=>void;onTest:(config:Settings)=>Promise<any>};
const LABELS:Record<string,string>={sjtu:'上海交大模型平台',deepseek:'DeepSeek',qwen:'通义千问',zhipu:'智谱',siliconflow:'硅基流动'};

export function ModelSettings({info={},value,onChange,onApply,onTest}:Props){
  const local=info?.edition==='local';
  const [draft,setDraft]=useState<Settings>({...value,source:local?(value.source==='rules'?'rules':'server'):info?.remoteManaged?(value.source==='rules'||!info?.configured?'rules':'server'):value.source|| (info?.configured?'server':'rules')}),[testing,setTesting]=useState(false),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[showKey,setShowKey]=useState(false);
  const providers=info?.providerOptions||[];
  const update=(patch:Partial<Settings>)=>{setDraft(v=>({...v,...patch}));setResult(null);setError('');};
  const valid=()=>{if(!local&&draft.source==='session'&&(!draft.key.trim()||!draft.model.trim())){setError('请填写模型名称和对应服务的 API Key。');return false;}if(!local&&draft.source==='server'&&!info?.configured){setError('服务端尚未配置模型。');return false;}return true;};
  const requestConfig=()=>local?{provider:'',model:'',key:'',...(draft.source==='rules'?{source:'rules'}:{})}:draft;
  const test=async()=>{setError('');if(!valid())return;setTesting(true);setResult(null);try{setResult(await onTest(requestConfig()));}catch(e:any){setError(e.message);}finally{setTesting(false);}};
  const apply=()=>{if(!valid())return;onChange({...draft,key:draft.source==='session'?draft.key:''});onApply();};
  return <div className="modal-body model-settings">
    {info?.vision?.configured&&<p className="inline-note">图片草稿模型：{info.vision.model}。视觉结果需另行确认，不自动发布或认定物品归属。</p>}<div className="model-edition"><strong>{local?'本地模型版':'基础模型 API 版'}</strong><span>任务、工具与记忆由觅&还执行</span></div>
    {info?.remoteManaged&&<p className="inline-note">当前为校内体验入口，模型由服务端固定。可通过页面顶部切换版本；各版本任务数据独立。</p>}
    {local?<>
      <p>模型目的地固定为本机，服务端禁止外网模型与云端回退。</p>
      <label className="field-label">本轮使用方式<select aria-label="模型配置来源" value={draft.source} disabled={testing} onChange={e=>update({source:e.target.value})}><option value="server">使用本机开源模型</option><option value="rules">仅使用规则辅助</option></select></label>
      {draft.source==='rules'&&<p className="inline-note">不调用本机模型。检索、任务记录、登记和人工交接仍可使用，聊天会标注规则辅助。</p>}
      <label className="field-label">本机模型<input value={info.model||''} readOnly/></label>
      <p className="inline-note">请先准备模型权重并关闭推理运行器的云端功能。配置存在不代表服务已启动；已验证隔离断网核心流程，最终交付验收仍待完成。</p>
    </>:<>
      <label className="field-label">本轮使用方式<select aria-label="模型配置来源" value={draft.source} disabled={testing} onChange={e=>update({source:e.target.value})}>
        <option value="server" disabled={!info?.configured}>使用服务端配置{!info?.configured?'（未配置）':''}</option>{!info?.remoteManaged&&<option value="session">使用本页临时配置</option>}<option value="rules">仅使用规则辅助</option>
      </select></label>
      {draft.source==='server'&&<div className="model-config-summary"><strong>{info.providerLabel||LABELS[info.provider]||info.provider}</strong><span>{info.model}</span><p>{info?.remoteManaged?'使用组织者在服务端配置的模型，访客无需填写密钥。':'使用配套的服务与密钥。更换服务请选“使用本页临时配置”。'}</p></div>}
      {draft.source==='session'&&<>
        <label className="field-label">模型服务<select value={draft.provider} disabled={testing} onChange={e=>{const provider=providers.find((p:any)=>p.id===e.target.value);update({provider:e.target.value,model:provider?.model||'',key:''});}}>{providers.map((p:any)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field-label">模型名称<input value={draft.model} disabled={testing} maxLength={120} onChange={e=>update({model:e.target.value})} placeholder="填写账号实际有权使用的模型名称"/></label>
        <label className="field-label">API Key<div className="key-input"><input type={showKey?'text':'password'} autoComplete="off" spellCheck={false} value={draft.key} disabled={testing} maxLength={4096} onChange={e=>update({key:e.target.value})} placeholder="仅保留本页内存，不写入浏览器存储"/><button type="button" className="text-button" disabled={testing} onClick={()=>setShowKey(v=>!v)}>{showKey?'隐藏':'显示'}</button></div></label>
        <p className="inline-note">切换服务会清空本页密钥。模型预填值仅作示例，是否可用以对应平台和测试结果为准。</p>
      </>}
      {draft.source==='rules'&&<div className="model-config-summary"><strong>规则辅助</strong><p>不发起基础模型请求，可继续使用检索、地点学习、登记和交接流程。界面会明确标注此模式。</p></div>}
      {draft.source!=='rules'&&<p className="inline-note">模型对话会发送必要的任务描述与公开候选。私密核实信息与交接码不进入普通模型搜索。页面密钥只在点击应用后使用，关闭设置会放弃未应用修改。</p>}
    </>}
    {draft.source!=='rules'&&<div className="model-test-area"><button type="button" className="button outlined full" disabled={testing} onClick={test}>{testing?'正在测试连接与工具调用…':'测试连接与工具调用'}</button><p className="inline-note">{local?'仅检查固定的本机模型接口，使用合成消息，不带真实记录，不会自动下载模型。':'点击后发送一条合成测试消息，不带寻物记录；API平台可能计费。不会自动测试或重复请求。'}</p></div>}
    {result&&<div className={'model-test-result '+(result.toolCalling?'success':'warning')} role="status"><strong>{result.toolCalling?'连接与工具调用通过':result.connected?'连接成功，工具调用待核对':'连接未完成'}</strong><p>{result.message}</p><small>{result.model} · {(result.elapsedMs/1000).toFixed(1)}秒{result.usage?.inputTokens!=null?' · 输入 '+result.usage.inputTokens+' / 输出 '+result.usage.outputTokens+' token':''}</small></div>}
    {error&&<p className="inline-warning" role="alert">{error}</p>}
    <button type="button" className="button primary full" disabled={testing} onClick={apply}>应用并关闭</button>
  </div>;
}
