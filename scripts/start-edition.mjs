import './sites-env.mjs';
import {existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const edition=process.argv[2]||'api';
if(!['api','local'].includes(edition))throw new Error('请选择 api 或 local 版本。');
process.env.XUNHUI_EDITION=edition;
const run=(script,args=[])=>{
  const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
};
if(edition==='local'){
  process.env.CLOUDFLARE_ENV='local';
  // Wrangler uses this complete environment-specific file rather than .dev.vars.
  const path='.dev.vars.local';
  if(!existsSync(path))writeFileSync(path,readFileSync('config/local.env.example'),{mode:0o600});
  const lines=readFileSync(path,'utf8').split(/\r?\n/);
  for(const line of lines){
    if(!line.trim()||line.trim().startsWith('#'))continue;
    if(!/^\s*(XUNHUI_EDITION|LOCAL_MODEL_NAME)\s*=/.test(line))throw new Error('本地版配置只能包含 XUNHUI_EDITION 和 LOCAL_MODEL_NAME，请移除其他配置。');
  }
  chmodSync(path,0o600);
  console.log('启动本地版：仅使用本机开源模型；模型服务未启动时会明确降级为本地规则。');
}else{
  delete process.env.CLOUDFLARE_ENV;
  if(existsSync('.env.sjtu.local'))run('scripts/configure-sjtu-local.mjs');
  console.log('启动 API 版：允许调用配置的基础模型服务。');
}
if(!existsSync('dist/server/wrangler.json'))run('scripts/run-framework.mjs',['build']);
run('scripts/migrate-local.mjs');
// This checkout runs one edition at a time. Final packages have independent roots.
process.argv=[process.execPath,'scripts/run-framework.mjs','dev'];
await import('./run-framework.mjs');
