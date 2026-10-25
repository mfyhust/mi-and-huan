// Idempotent initial local schema setup. Hosted migrations use unchanged drizzle/*.sql.
import './sites-env.mjs';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(!existsSync('dist/server/wrangler.json'))throw new Error('请先运行 npm run build，再初始化本地数据库。');
mkdirSync('.sites-runtime',{recursive:true});
const sql=readFileSync('drizzle/0000_military_otto_octavius.sql','utf8').replaceAll('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `').replaceAll('CREATE INDEX `','CREATE INDEX IF NOT EXISTS `');
writeFileSync('.sites-runtime/initial-local-schema.sql',sql);
const state=process.env.XUNHUI_EDITION==='local'?'.wrangler/local-state':'.wrangler/state';
const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to',state,'--file','.sites-runtime/initial-local-schema.sql'],{stdio:'inherit'});
if(r.error)throw r.error;process.exit(r.status??1);
