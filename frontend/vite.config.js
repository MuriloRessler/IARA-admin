import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [projectRoot] },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
  },
});
