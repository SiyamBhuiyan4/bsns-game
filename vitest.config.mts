import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    env: {
      ...env,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

