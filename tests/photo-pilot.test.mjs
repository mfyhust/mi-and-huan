import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {scorePhotoDraft,photoPilotArgs,loadPhotoPilot,preparePhoto} from '../evals/photo-pilot.mjs';
test('照片评测区分错误、谨慎留空、无依据断言和不计分人工复核',()=>{
 const expected={category:{visible:true,accepted:['水杯']},color:{visible:true,accepted:['绿色']},brand:{visible:false,accepted:[]}};
 const a=scorePhotoDraft({category:'水杯',color:'深绿色',brand:''},expected);assert.equal(a.color.status,'correct');assert.equal(a.brand.status,'correct-abstention');
 const b=scorePhotoDraft({category:'其他',color:'',brand:'猜测品牌'},expected);assert.equal(b.category.status,'wrong');assert.equal(b.color.status,'abstained');assert.equal(b.brand.status,'unsupported-assertion');
 assert.equal(scorePhotoDraft({color:'黑色'},{color:{visible:false,accepted:[],scored:false}}).color.status,'manual-review');
});
test('照片评测默认不推理，API实际运行需要明确公开图片标记',()=>{
 assert.deepEqual(photoPilotArgs([]),{run:false,edition:'local',policy:'baseline',suite:'pilot',allowPublicApi:false});assert.throws(()=>photoPilotArgs(['--run','--edition','api']),/公开/);assert.equal(photoPilotArgs(['--run','--edition','api','--allow-public-api']).run,true);assert.throws(()=>photoPilotArgs(['--dataset','/business/photos']));
});
test('评测照片来源、摘要和目录边界均校验，不能悄悄替换业务照片',()=>{
 assert.equal(loadPhotoPilot().cases.length,3);assert.equal(loadPhotoPilot(fileURLToPath(new URL('../evals/real-photo-holdout/manifest.json',import.meta.url))).cases.length,3);assert.equal(photoPilotArgs(['--suite','holdout']).suite,'holdout');assert.throws(()=>photoPilotArgs(['--suite','private']));
 const dir=mkdtempSync(join(tmpdir(),'migui-photo-manifest-')),path=join(dir,'manifest.json'),bytes=Buffer.from('synthetic-hash-fixture');writeFileSync(join(dir,'fixture.jpg'),bytes);
 const c={id:'fixture',file:'fixture.jpg',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:{license:'CC0-1.0',page:'https://commons.wikimedia.org/wiki/File:fixture.jpg',author:'Synthetic',reviewed:true},expected:{category:{visible:true,accepted:['水杯']},color:{visible:false,accepted:[]},brand:{visible:false,accepted:[]}}};
 try{
  for(const patch of [{provenance:{...c.provenance,license:'unknown'}},{sha256:'bad'},{file:new URL('../evals/real-photo-pilot/images/bottle.jpg',import.meta.url).pathname},{expected:{}}]){writeFileSync(path,JSON.stringify({cases:[{...c,...patch}]}));assert.throws(()=>loadPhotoPilot(path));}
  writeFileSync(path,JSON.stringify({cases:[c,c]}));assert.throws(()=>loadPhotoPilot(path),/重复/);
 }finally{rmSync(dir,{recursive:true});}
});
test('大图按同一预处理输出可上传JPEG，两版输入摘要可以逐字节比较',async()=>{
 const bytes=readFileSync(new URL('../evals/real-photo-pilot/images/keys.jpg',import.meta.url)),a=await preparePhoto(bytes),b=await preparePhoto(bytes);
 assert.ok(bytes.length>2*1024*1024);assert.ok(a.length<2*1024*1024);assert.equal(a[0],255);assert.equal(a[1],216);assert.deepEqual(a,b);
 const sharp=(await import('sharp')).default,meta=await sharp(a).metadata();assert.ok(meta.width<=1000&&meta.height<=1000);assert.equal(meta.exif,undefined);
});
