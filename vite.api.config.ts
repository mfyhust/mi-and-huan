import {defineConfig,mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.offline.config';
export default mergeConfig(base,defineConfig({
 define:{__XUNHUI_EDITION__:JSON.stringify('api')},
 plugins:[{name:'api-page-title',transformIndexHtml(html){return html.replaceAll('本地离线开发版','API 版').replace('本机任务、工具、数据与模型','本机任务、工具、数据与基础模型API');}}],
 build:{outDir:fileURLToPath(new URL('./dist-api/',import.meta.url)),emptyOutDir:true}
}));
