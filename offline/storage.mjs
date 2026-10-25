import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,chmodSync,writeFileSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export function openDatabase(path){
  const raw=new DatabaseSync(path);
  raw.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
  raw.exec(readFileSync(new URL('../drizzle/0000_military_otto_octavius.sql',import.meta.url),'utf8').replaceAll('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `').replaceAll('CREATE INDEX `','CREATE INDEX IF NOT EXISTS `'));
  if(path!==':memory:')chmodSync(path,0o600);
  const db={raw,prepare(sql){
    const stmt=raw.prepare(sql);let args=[];
    return {bind(...values){args=values;return this;},first(){return stmt.get(...args)||null;},all(){return {results:stmt.all(...args)};},run(){return {meta:{changes:Number(stmt.run(...args).changes)}};}};
  },batch(statements){
    // Synchronous statements keep another request from entering this transaction.
    raw.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.run());raw.exec('COMMIT');return results;}catch(error){raw.exec('ROLLBACK');throw error;}
  },close(){raw.close();}};
  return db;
}
export function installationId(dir){
  mkdirSync(dir,{recursive:true,mode:0o700});
  const path=join(dir,'installation.json');let data;
  try{data=JSON.parse(readFileSync(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('本地工作区标识不可读，请保留数据并检查配置。');data={id:crypto.randomUUID()};writeFileSync(path,JSON.stringify(data),{flag:'wx',mode:0o600});}
  if(!/^[a-f0-9-]{36}$/.test(data.id||''))throw new Error('本地工作区标识格式不正确，未重置数据。');
  return data.id;
}
export function fileBucket(dir){
  mkdirSync(dir,{recursive:true,mode:0o700});
  const file=key=>{if(!/^images\/[a-f0-9-]{36}$/.test(key))throw new Error('图片标识不正确。');return join(dir,key.slice(7));};
  return {async put(key,bytes){await writeFile(file(key),new Uint8Array(bytes),{mode:0o600});},async get(key){try{const bytes=await readFile(file(key));return {body:new Uint8Array(bytes),async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}};}catch(error){if(error.code==='ENOENT')return null;throw error;}}};
}
