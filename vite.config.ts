import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react({ fastRefresh: true }), tailwindcss()],
  resolve: {
    preserveSymlinks: true,
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  build: {
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
    watch: {
      ignored: [
        '**/server/**',
        '**/electron/**',
        '**/data/**',
        '**/dist/**',
        '**/release*/**',
        '**/docs/**',
        '**/scripts/**',
      ],
    },
    proxy: {
      '/api/dashboard/alerts/stream': {
        target: 'http://localhost:3847',
        changeOrigin: true,
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
      '/api/sync/monitor/stream': {
        target: 'http://localhost:3847',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
      '/api': { target: 'http://localhost:3847', changeOrigin: true },
    },
  },
});
