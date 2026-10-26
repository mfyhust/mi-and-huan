import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {ollamaBinary} from '../offline/runtime-path.mjs';
test('Windows仅选择exe运行器，不会误用同目录Linux可执行文件',()=>{
 const windows=ollamaBinary({platform:'win32',env:{},exists:p=>p.endsWith('ollama.exe')});assert.match(windows,/ollama-windows-amd64/);assert.ok(windows.endsWith('.exe'));
 assert.equal(ollamaBinary({platform:'win32',env:{},exists:p=>p.endsWith('/bin/ollama')}),'ollama.exe');
 const installed=join('synthetic-local-app','Programs','Ollama','ollama.exe');assert.equal(ollamaBinary({platform:'win32',env:{LOCALAPPDATA:'synthetic-local-app'},exists:p=>p===installed}),installed);
});
test('Linux运行器查找保持兼容，缺少捆绑运行器时使用PATH',()=>{
 assert.match(ollamaBinary({platform:'linux',exists:()=>true}),/ollama-v0\.40\.6/);assert.equal(ollamaBinary({platform:'linux',exists:()=>false}),'ollama');
});
