// eslint.config.mjs
import tsPlugin  from '@typescript-eslint/eslint-plugin';
import tsParser  from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any':            'error',
      '@typescript-eslint/no-unused-vars':             ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // NestJS patterns
      '@typescript-eslint/no-floating-promises':       'error',
      '@typescript-eslint/await-thenable':             'error',

      // General
      'no-console':  'warn',
      'eqeqeq':      ['error', 'always'],
    },
  },
];