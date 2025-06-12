import rootConfig from '../../eslint.config.mjs';
import importPlugin from 'eslint-plugin-import';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
    },
  },
];
