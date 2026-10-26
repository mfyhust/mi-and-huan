// Local readiness only: no model requests, downloads or credential reads.
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {totalmem,freemem} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {normalizePhoto} from '../remote/media.mjs';
import {ollamaBinary} from '../offline/runtime-path.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE readiness(value INTEGER);INSERT INTO readiness VALUES(1)');const sqlite=db.prepare('SELECT value FROM readiness').get().value===1;db.close();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWPwAgMGCAUAGFYDeZ7bwMQAAAAASUVORK5CYII=','base64');
let photos=false;try{const result=await normalizePhoto(png);photos=result[0]===255&&result[1]===216;}catch{}
const report={platform:process.platform,arch:process.arch,node:process.versions.node,memoryGiB:Math.round(totalmem()/1024**3),freeMemoryGiB:Math.round(freemem()/1024**3),sqlite,photos,apiPage:existsSync(join(root,'dist-api','index.html')),localPage:existsSync(join(root,'dist-offline','index.html')),modelFilesPresent:existsSync(join(root,'.offline-models','manifests')),ollama:ollamaBinary(),modelInferenceTested:false};
console.log(JSON.stringify(report,null,2));
console.log('本检查只检查本机运行条件，未调用API、未加载模型。请把输出发给开发者。');
if(!sqlite||!photos)process.exitCode=1;
