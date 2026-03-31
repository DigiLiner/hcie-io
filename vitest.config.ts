import { defineConfig } from 'vitest/config';

import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@hcie/core': path.resolve(__dirname, './src/mocks/core.ts'),
      '@hcie/shared': path.resolve(__dirname, './src/mocks/shared.ts'),
    },
  },
});

