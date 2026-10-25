import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let sharp;
try{sharp=require('sharp');}
catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;sharp=require('../runtime/node_modules/sharp');}
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const MAX_UPLOAD_BYTES=2*1024*1024;
// Decode and re-encode locally: the uploaded payload and its metadata are never served.
export async function normalizePhoto(bytes){
 if(!bytes.length||bytes.length>MAX_UPLOAD_BYTES)fail('请上传不超过2MB的照片。',413);
 try{
  const image=sharp(bytes,{limitInputPixels:24_000_000,failOn:'warning',animated:false});
  const metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||metadata.pages>1)fail('仅支持静态JPEG、PNG、WebP照片。');
  const output=await image.rotate().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:82}).toBuffer();
  if(output.length>MAX_UPLOAD_BYTES)fail('压缩后的照片仍然过大，请换一张照片。',413);
  return output;
 }catch(error){if(error.status)throw error;fail('照片无法完整读取，请换一张JPEG、PNG或WebP图片。');}
}
