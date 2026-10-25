import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {Store} from '../lib/store.mjs';
import {Service} from '../lib/service.mjs';
export function database(file=':memory:',init=true){const raw=new DatabaseSync(file);if(init)raw.exec(readFileSync(new URL('../drizzle/0000_military_otto_octavius.sql',import.meta.url),'utf8'));const db={raw,prepare(sql){const statement=raw.prepare(sql);let args=[];const d={bind(...a){args=a;return d;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};}};return d;},async batch(statements){raw.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;}
export function service(db,actor='lin',space='demo:test',env={}){return new Service(new Store(db,space),{actor,role:actor==='volunteer'?'admin':'member',profile:{name:actor},demo:true,env});}
