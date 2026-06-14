// eslint.config.js
import tsPlugin   from '@typescript-eslint/eslint-plugin';
import tsParser   from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks':        reactHooks,
      'react-refresh':      reactRefresh,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any':            'error',
      '@typescript-eslint/no-unused-vars':             ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises':       'error',
      '@typescript-eslint/consistent-type-imports':    ['error', { prefer: 'type-imports' }],

      // React
      'react-hooks/rules-of-hooks':  'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // General
      'no-console':  'warn',
      'eqeqeq':      ['error', 'always'],
    },
  },
];