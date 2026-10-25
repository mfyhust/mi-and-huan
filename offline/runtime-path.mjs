import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function ollamaBinary(){
  const local=fileURLToPath(new URL('../.offline-runtime/ollama-v0.40.6/bin/ollama',import.meta.url));
  return existsSync(local)?local:'ollama';
}
