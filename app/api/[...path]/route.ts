import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { Store } from '../../../lib/store.mjs';
import { Service, handleApi } from '../../../lib/service.mjs';
import { DEMO_ACTORS } from '../../../lib/seed.mjs';

export const dynamic='force-dynamic';
async function handler(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'请先登录，再保存寻物记录。',signIn:'/signin-with-chatgpt?return_to=/'},{status:401});
  const runtime=env as any;
  if(!runtime.DB)return Response.json({error:'数据库尚未准备好，请完成迁移后重试。'},{status:503});
  const demo=request.headers.get('x-demo-mode')!=='0'&&!(request.method==='GET'&&new URL(request.url).pathname.includes('/media/')&&new URL(request.url).searchParams.get('mode')==='live');
  const key=request.headers.get('x-demo-actor')||'lin';
  const profile=demo?(DEMO_ACTORS as any)[key]:{name:user.fullName||user.email,role:user.userId===runtime.ADMIN_USER_ID?'admin':'member',initial:'我'};
  if(!profile)return Response.json({error:'无效体验角色。'},{status:400});
  const space=demo?'demo:'+user.userId:'campus';
  const actor=demo?key:user.userId;
  const service=new Service(new Store(runtime.DB,space),{actor,role:profile.role,profile,demo,env:runtime});
  return handleApi(request,service);
}
export const GET=handler;
export const POST=handler;
