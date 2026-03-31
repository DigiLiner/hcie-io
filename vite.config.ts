import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@hcie/core', replacement: path.resolve(__dirname, 'src/mocks/core.ts') },
      { find: '@hcie/shared', replacement: path.resolve(__dirname, 'src/mocks/shared.ts') },
    ],
  },
  // Ensure we can load from root
  root: './',
  build: {
    outDir: 'dist',
  }
});
