/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The listmonk binary serves the build at /app. In dev, API and login
// requests are proxied to a listmonk instance on :9000.
const backend = process.env.LISTMONK_URL || 'http://localhost:9000';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/admin': backend,
      '/public': backend,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
