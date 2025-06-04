import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
    },
  },
];
