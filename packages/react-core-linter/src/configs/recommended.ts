/**
 * Recommended ESLint configuration for React Core
 */

import { ESLint } from 'eslint';

function injectRecommended(plugin: ESLint.Plugin): ESLint.Plugin {
  return {
    ...plugin,
    configs: {
      ...plugin.configs,
      recommended: {
        plugins: { '@generaltranslation/react-core-linter': plugin },
        rules: {
          '@generaltranslation/react-core-linter/static-jsx': 'error',
          '@generaltranslation/react-core-linter/static-string': 'error',
        },
      },
    },
  };
}

export { injectRecommended };
