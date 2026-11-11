// Runs the DevTools panel in a normal browser with fake data: `npm run preview`
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./preview', import.meta.url)),
  resolve: {
    alias: {
      '@rozenite/plugin-bridge': fileURLToPath(
        new URL('./preview/mock-bridge.ts', import.meta.url),
      ),
    },
  },
  css: { postcss: fileURLToPath(new URL('.', import.meta.url)) },
  server: { port: 3200 },
});
