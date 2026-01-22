import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types.ts', 'src/cli.ts', 'src/server.ts', 'src/tools/suggester.ts'],
      thresholds: {
        statements: 75,
        branches: 60,
        functions: 65,
        lines: 75,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
