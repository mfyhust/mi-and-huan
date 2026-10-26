import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export function ollamaBinary({platform=process.platform,env=process.env,exists=existsSync}={}){
  const relative=platform==='win32'?'../.offline-runtime/ollama-windows-amd64/ollama.exe':'../.offline-runtime/ollama-v0.40.6/bin/ollama';
  const local=fileURLToPath(new URL(relative,import.meta.url));
  if(exists(local))return local;
  if(platform==='win32'&&env.LOCALAPPDATA){const installed=join(env.LOCALAPPDATA,'Programs','Ollama','ollama.exe');if(exists(installed))return installed;}
  return platform==='win32'?'ollama.exe':'ollama';
}
