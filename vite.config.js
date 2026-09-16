import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function onnxruntimePlugin() {
  return {
    name: 'vite-plugin-onnxruntime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/ort/')) {
          const cleanUrl = req.url.replace('/ort/', '').split('?')[0];
          const filePath = path.resolve('node_modules/onnxruntime-web/dist', cleanUrl);
          if (fs.existsSync(filePath)) {
            if (cleanUrl.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (cleanUrl.endsWith('.mjs') || cleanUrl.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
    generateBundle() {
      const srcDir = path.resolve('node_modules/onnxruntime-web/dist');
      if (!fs.existsSync(srcDir)) return;
      const files = fs.readdirSync(srcDir).filter(f => f.startsWith('ort-wasm'));
      for (const file of files) {
        const fullPath = path.join(srcDir, file);
        if (fs.statSync(fullPath).isFile()) {
          this.emitFile({
            type: 'asset',
            fileName: `ort/${file}`,
            source: fs.readFileSync(fullPath)
          });
        }
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), onnxruntimePlugin()],
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  assetsInclude: ['**/*.onnx'],
})
