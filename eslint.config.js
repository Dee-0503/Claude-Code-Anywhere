import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '.agents/**',
      '.claude/worktrees/**',
      '**/*.js',
      '**/*.d.ts',
      '**/*.map'
    ]
  },
  {
    files: ['backend/src/**/*.{ts,tsx}', 'frontend/src/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./shared/tsconfig.json', './backend/tsconfig.json', './frontend/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  }
);
