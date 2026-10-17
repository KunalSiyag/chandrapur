import { defineConfig, loadEnv } from 'vite';
import { npcApi } from './server/npc-brain.mjs';

export default defineConfig(({ mode }) => {
  // server-side only: no VITE_ prefix, so keys never reach the bundle
  const api = npcApi(loadEnv(mode, process.cwd(), ''));
  const villagers = {
    name: 'chandrapur-villagers',
    configureServer(server) { server.middlewares.use(api); },
    configurePreviewServer(server) { server.middlewares.use(api); },
  };
  return {
    base: './',
    plugins: [villagers],
    server: { port: 5173, open: false },
    build: { target: 'esnext', outDir: 'dist' },
  };
});
