// Local accounts only. No external identity provider and no plaintext passwords.
import {DatabaseSync} from 'node:sqlite';
import {scrypt,randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const failure=message=>Object.assign(new Error(message),{status:400});
export class AccountStore{
 constructor(path,{now=Date.now}={}){
  mkdirSync(dirname(path),{recursive:true,mode:0o700});this.now=now;this.db=new DatabaseSync(path);chmodSync(path,0o600);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
   CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,nickname TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,edition TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS account_session_user ON account_sessions(user_id);`);
 }
 publicUser(row){return row?{id:row.id,username:row.username,nickname:row.nickname}:null;}
 async register({username,password,confirmation,nickname}){
  username=String(username||'').trim().toLowerCase();nickname=String(nickname||username).trim();
  if(!/^[a-z][a-z0-9_]{2,31}$/.test(username))throw failure('用户名须为3—32位字母、数字或下划线，并以字母开头。');
  if(typeof password!=='string'||password.length<8||password.length>128)throw failure('密码请填写8—128个字符。');
  if(password!==confirmation)throw failure('两次输入的密码不一致。');
  if(!nickname||nickname.length>24||/[\x00-\x1f\x7f]/.test(nickname))throw failure('昵称请控制在1—24个字符。');
  if(this.db.prepare('SELECT id FROM accounts WHERE username=?').get(username))throw failure('这个用户名已被使用，请换一个。');
  if(this.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n>=500)throw failure('当前体验账号数量已满，请联系组织者。');
  const salt=randomBytes(16).toString('hex'),derived=await derive(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}),id=randomUUID();
  try{this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run(id,username,nickname,salt,derived.toString('hex'),this.now());}catch(e){if(/UNIQUE/.test(e.message))throw failure('这个用户名已被使用，请换一个。');throw e;}
  return {id,username,nickname};
 }
 async login({username,password}){
  const row=this.db.prepare('SELECT * FROM accounts WHERE username=?').get(String(username||'').trim().toLowerCase());
  if(typeof password!=='string'||password.length>128)throw failure('用户名或密码不正确。');
  const derived=await derive(password,row?.salt||'00000000000000000000000000000000',64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  if(!row||!timingSafeEqual(derived,Buffer.from(row.password_hash,'hex')))throw failure('用户名或密码不正确。');
  return this.publicUser(row);
 }
 issue(user,edition,remember=false){
  const token=randomBytes(32).toString('hex'),maxAge=remember?7*86400:8*3600;
  this.db.prepare('DELETE FROM account_sessions WHERE expires<=?').run(this.now());
  this.db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)').run(hash(token),user.id,edition,this.now()+maxAge*1000);return {token,maxAge};
 }
 authenticate(token,edition){
  if(!/^[a-f0-9]{64}$/.test(token||''))return null;
  return this.publicUser(this.db.prepare('SELECT a.id,a.username,a.nickname FROM accounts a JOIN account_sessions s ON a.id=s.user_id WHERE s.token_hash=? AND s.edition=? AND s.expires>?').get(hash(token),edition,this.now()));
 }
 revoke(token,edition){if(token)this.db.prepare('DELETE FROM account_sessions WHERE token_hash=? AND edition=?').run(hash(token),edition);}
 close(){this.db.close();}
}
