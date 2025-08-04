import { noUnwrappedDynamicContent } from './rules/no-unwrapped-dynamic-content';

export = {
  meta: {
    name: '@gt-next/eslint-plugin',
    version: '1.0.0'
  },
  rules: {
    'no-unwrapped-dynamic-content': noUnwrappedDynamicContent
  },
  configs: {
    recommended: {
      plugins: ['@gt-next'],
      rules: {
        '@gt-next/no-unwrapped-dynamic-content': 'warn'
      }
    },
    strict: {
      plugins: ['@gt-next'],
      rules: {
        '@gt-next/no-unwrapped-dynamic-content': 'error'
      }
    }
  }
};