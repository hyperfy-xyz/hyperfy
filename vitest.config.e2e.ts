import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/__tests__/e2e/**/*.{test,spec}.{js,ts}'],
    testTimeout: 60000, // Longer timeout for E2E tests
    hookTimeout: 60000,
    pool: 'forks', // Better isolation for E2E tests
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially
      }
    },
  }
}); 