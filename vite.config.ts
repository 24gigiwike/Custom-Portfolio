import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { imageKitDevPlugin } from './src/server/imageKitDevPlugin';
import { portfolioSeoPlugin } from './src/server/seoPlugin';

const IMAGE_WORKER_FILE = 'browser-image-compression.js';

/** Serve the compression UMD build from this origin so the worker does not load jsDelivr. */
function imageCompressionWorkerPlugin(root: string): Plugin {
  const sourcePath = path.resolve(root, 'node_modules/browser-image-compression/dist/browser-image-compression.js');
  const serve = (requestUrl: string | undefined, send: (body: Buffer) => void): boolean => {
    const pathname = requestUrl?.split('?')[0];
    if (pathname !== `/${IMAGE_WORKER_FILE}`) return false;
    send(fs.readFileSync(sourcePath));
    return true;
  };
  return {
    name: 'self-host-image-compression-worker',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serve(req.url, (body) => {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(body);
        })) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serve(req.url, (body) => {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.end(body);
        })) next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: IMAGE_WORKER_FILE,
        source: fs.readFileSync(sourcePath),
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [imageKitDevPlugin(), react(), tailwindcss(), portfolioSeoPlugin(__dirname), imageCompressionWorkerPlugin(__dirname)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
