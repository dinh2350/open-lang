import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      strictPort: true,
      // The browser sees one origin; /api goes to the backend.
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:3000',
          // Sends the browser's IP in X-Forwarded-For, which the backend
          // trusts from this host only, so rate limits count per browser.
          xfwd: true,
        },
      },
    },
  };
});
