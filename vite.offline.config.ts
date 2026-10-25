import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('./offline/',import.meta.url)),
  publicDir:fileURLToPath(new URL('./public/',import.meta.url)),
  plugins:[react()],
  define:{__XUNHUI_EDITION__:JSON.stringify('local')},
  build:{outDir:fileURLToPath(new URL('./dist-offline/',import.meta.url)),emptyOutDir:true},
});
