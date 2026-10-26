// Explicit local provisioning. Public registration can never request administrator rights.
import {randomBytes} from 'node:crypto';
import {writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AccountStore} from '../remote/accounts.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const username=value('--username','migui_admin'),dataDir=resolve(root,value('--data-dir','.remote-data')),output=resolve(root,value('--output','.remote-data/admin-login.txt'));
if(!args.includes('--create')){console.log('计划：仅在本机账号库创建专用管理员；不会启动服务或上传数据。明确执行：node scripts/create-admin.mjs --create。登录资料只写入被Git忽略的.remote-data目录，不打印密码。');process.exit(0);}
if(!/^[a-z][a-z0-9_]{2,31}$/.test(username))throw new Error('管理员用户名不合法。');
if(!output.startsWith(dataDir+'/'))throw new Error('登录资料必须放在指定私密数据目录内。');
if(existsSync(output))throw new Error('登录资料已存在，未覆盖或重置账号。');
mkdirSync(dirname(output),{recursive:true,mode:0o700});
const accounts=new AccountStore(resolve(dataDir,'accounts.sqlite'));
if(accounts.db.prepare('SELECT id FROM accounts WHERE username=?').get(username)){accounts.close();throw new Error('该账号已存在，未改动原账号。');}
const password=randomBytes(18).toString('base64url');
writeFileSync(output,'觅&还管理员登录资料（仅本人保管，不提交、不上传）\n\n用户名：'+username+'\n密码：'+password+'\n\nAPI版与本地版使用同一套校内账号；分别登录，业务数据与留言分版。进入“联系管理员”查看和回复留言。拥有本空间人工管理权限，不代表学校官方。\n',{mode:0o600,flag:'wx'});
try{await accounts.createAdmin({username,password,confirmation:password,nickname:'觅&还管理员'});console.log('已创建专用管理员 '+username+'；登录资料已写入私密文件，不在终端显示密码。');}finally{accounts.close();}
