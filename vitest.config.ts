import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'backend/tests/**/*.test.ts',
      'frontend/tests/**/*.test.{ts,tsx}',
      'shared/tests/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      include: ['backend/src/**/*.ts', 'frontend/src/protocol/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/tests/**',
        '**/node_modules/**',
        '**/dist/**'
      ],
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage'
    },
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['backend/tests/**/*.test.ts'],
          testTimeout: 10_000
        }
      },
      {
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['frontend/tests/**/*.test.{ts,tsx}']
        }
      },
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['shared/tests/**/*.test.ts']
        }
      }
    ]
  }
});
