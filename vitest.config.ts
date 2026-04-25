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
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage'
    },
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['backend/tests/**/*.test.ts']
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
