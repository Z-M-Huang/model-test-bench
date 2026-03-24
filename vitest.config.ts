import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/server/services/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/fs-adapter.ts', '**/*-test-helpers.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
