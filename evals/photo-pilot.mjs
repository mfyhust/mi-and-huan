// Evaluation only: public, licensed fixtures; never read a business photo directory.
import {readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalColor} from '../lib/matching.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SUITES={pilot:'real-photo-pilot',holdout:'real-photo-holdout'};
export function scorePhotoDraft(draft,expected){
 const fields={};
 for(const key of ['category','color','brand']){
  const truth=expected[key];if(!truth)continue;
  const normalize=v=>key==='color'?canonicalColor(v).toLowerCase():String(v||'').trim().toLowerCase();
  const actual=normalize(draft?.[key]);
  if(truth.scored===false){fields[key]={actual:draft?.[key]||'',status:'manual-review'};continue;}
  fields[key]={actual:draft?.[key]||'',status:truth.visible===false?(actual?'unsupported-assertion':'correct-abstention'):!actual?'abstained':truth.accepted.some(v=>normalize(v)===actual)?'correct':'wrong'};
 }
 return fields;
}
export function loadPhotoPilot(manifestPath=join(ROOT,'evals/real-photo-pilot/manifest.json')){
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),base=realpathSync(dirname(manifestPath));
 if(!Array.isArray(manifest.cases)||manifest.cases.length<1||manifest.cases.length>12)throw new Error('评测仅接受1到12张已标注公开照片。');
 const ids=new Set();
 for(const c of manifest.cases){
  if(!/^[a-z0-9-]{1,40}$/.test(c.id)||ids.has(c.id))throw new Error('照片案例ID无效或重复。');ids.add(c.id);
  if(c.provenance?.license!=='CC0-1.0'||!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.provenance?.page||'')||!c.provenance?.author||c.provenance?.reviewed!==true)throw new Error('本入口仅接受已核对来源的公开CC0照片。');
  const full=realpathSync(resolve(base,c.file)),rel=relative(base,full);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('照片必须位于独立评测目录内。');
  const bytes=readFileSync(full);if(bytes.length>10*1024*1024||createHash('sha256').update(bytes).digest('hex')!==c.sha256)throw new Error('照片大小或摘要与预标注不一致。');
  for(const key of ['category','color','brand']){const truth=c.expected?.[key];if(!truth||typeof truth.visible!=='boolean'||!Array.isArray(truth.accepted)||truth.accepted.some(v=>typeof v!=='string')||truth.visible&&!truth.accepted.length)throw new Error('缺少有效的逐字段预标注。');}
 }
 return manifest;
}
export function photoPilotArgs(args){
 const options={run:false,edition:'local',policy:'baseline',suite:'pilot',allowPublicApi:false};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--run')options.run=true;
  else if(args[i]==='--allow-public-api')options.allowPublicApi=true;
  else if(args[i]==='--suite'&&Object.hasOwn(SUITES,args[i+1]))options.suite=args[++i];
  else if(args[i]==='--policy'&&['baseline','cautious'].includes(args[i+1]))options.policy=args[++i];
  else if(args[i]==='--edition'&&['local','api'].includes(args[i+1]))options.edition=args[++i];
  else throw new Error('仅支持 --run、--edition local|api、--policy baseline|cautious、--suite pilot|holdout、--allow-public-api。');
 }
 if(options.run&&options.edition==='api'&&!options.allowPublicApi)throw new Error('API评测须显式 --allow-public-api；仅限本入口的公开CC0照片。');return options;
}
export async function preparePhoto(bytes){
 const sharp=(await import('sharp')).default;
 return sharp(bytes,{limitInputPixels:24000000}).rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();
}
export async function runPhotoPilot(options){
 if(!['local','api'].includes(options.edition)||!['baseline','cautious'].includes(options.policy)||!Object.hasOwn(SUITES,options.suite))throw new Error('未知照片评测版本、策略或数据集。');
 if(options.run&&options.edition==='api'&&!options.allowPublicApi)throw new Error('API评测须显式授权本入口公开照片。');
 const manifestPath=join(ROOT,'evals',SUITES[options.suite],'manifest.json'),manifest=loadPhotoPilot(manifestPath);
 const {visionPrompt}=await import('../lib/vision-draft.mjs');
 const promptSha256=createHash('sha256').update(visionPrompt(undefined,options.policy)).digest('hex');
 if(options.suite==='holdout'&&manifest.frozenPromptSha256?.[options.policy]!==promptSha256)throw new Error('独立复测提示已改变，请保留原结果，不能继续当作未调试数据。');
 const plan={runsModel:options.run,edition:options.edition,policy:options.policy,suite:options.suite,promptSha256,cases:manifest.cases.length,scope:'public CC0 fixtures only; no business records or photos',labelStatus:manifest.labelStatus};
 if(!options.run)return plan;
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os');
 const {createOfflineApp,createApiApp}=await import('../offline/server.mjs');
 let apiConfig;if(options.edition==='api'){const {readApiConfig,apiConfigPath}=await import('../api/server.mjs');apiConfig=readApiConfig(apiConfigPath());if(apiConfig.provider!=='sjtu'||!apiConfig.key||!apiConfig.visionModel)throw new Error('需配置交大平台视觉模型；不会自动切换平台。');}
 const dataDir=mkdtempSync(join(tmpdir(),'migui-public-vision-')),app=options.edition==='local'?createOfflineApp({dataDir,visionPolicy:options.policy}):createApiApp({dataDir,apiConfig,visionPolicy:options.policy});
 const report={...plan,generatedAt:new Date().toISOString(),manifestSha256:createHash('sha256').update(readFileSync(manifestPath)).digest('hex'),sourceSha256:Object.fromEntries(['lib/vision-draft.mjs','lib/agent.mjs','lib/model-runtime.mjs','offline/server.mjs','evals/photo-pilot.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(join(ROOT,p))).digest('hex')])),rows:[],completed:false,accuracyClaimed:false};
 const deadline=Date.now()+600000;let cookie='';
 const request=async(path,body)=>{
  const response=await app.dispatch(new Request('http://127.0.0.1/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'x-demo-mode':'0',...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}));
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'评测请求失败'),{code:data.code||'HTTP_'+response.status});return data;
 };
 try{
  const page=await app.dispatch(new Request('http://127.0.0.1/'));cookie=page.headers.get('set-cookie').split(';')[0];
  const boot=await request('api/bootstrap');report.model=boot.model.vision;
  for(const c of manifest.cases){
   if(Date.now()>deadline)throw new Error('评测已达到10分钟总预算。');
   const started=Date.now(),row={id:c.id,imageSha256:c.sha256,success:false};
   try{
    const prepared=await preparePhoto(readFileSync(resolve(dirname(manifestPath),c.file)));row.modelInputSha256=createHash('sha256').update(prepared).digest('hex');
    const form=new FormData();form.append('file',new Blob([prepared],{type:'image/jpeg'}),'evaluation.jpg');
    const media=await request('api/media',form);
    const result=await request('api/vision',{imageId:media.id,consentExternal:options.edition==='api',consentProvider:boot.model.vision.provider,consentModel:boot.model.vision.model});
    row.draft=result.draft;row.fields=scorePhotoDraft(result.draft,c.expected);row.usage=result.usage;row.needsConfirmation=result.needsConfirmation;row.modelElapsedMs=result.elapsedMs;row.success=true;
   }catch(error){row.error={code:error.code||'EVALUATION_ERROR',message:apiConfig?.key&&String(error.message).includes(apiConfig.key)?'模型请求失败，敏感细节未记录。':String(error.message).slice(0,250)};}
   row.elapsedMs=Date.now()-started;report.rows.push(row);console.log(JSON.stringify({case:c.id,edition:options.edition,success:row.success,fields:row.fields,error:row.error?.code,elapsedMs:row.elapsedMs}));
  }
  const after=await request('api/bootstrap');report.noAutomaticItemsOrTasks=after.myItems.length===0&&after.tasks.length===0;if(!report.noAutomaticItemsOrTasks)throw new Error('草稿评测不应自动创建物品或任务。');
  report.completed=true;
 }finally{
  await app.close();
  report.summary={completedCases:report.rows.length,successfulDrafts:report.rows.filter(r=>r.success).length,fieldCounts:{}};
  for(const row of report.rows)for(const [key,result] of Object.entries(row.fields||{})){report.summary.fieldCounts[key]??={};report.summary.fieldCounts[key][result.status]=(report.summary.fieldCounts[key][result.status]||0)+1;}
  const out=join(ROOT,'.offline-evaluations');mkdirSync(out,{recursive:true});report.path=join(out,'public-vision-'+options.suite+'-'+options.edition+'-'+Date.now()+'.json');writeFileSync(report.path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const result=await runPhotoPilot(photoPilotArgs(process.argv.slice(2)));console.log(JSON.stringify(result.runsModel?{report:result.path,completed:result.completed,summary:result.summary}:result,null,2));if(result.runsModel&&result.summary.successfulDrafts!==result.cases)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}}
