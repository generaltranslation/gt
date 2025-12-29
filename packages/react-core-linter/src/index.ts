/**
 * React Core ESLint Plugin
 *
 * Provides ESLint rules for General Translation React Core integration.
 * This plugin helps ensure correct usage of React Core i18n components
 * and translation patterns.
 */

import type { ESLint, Rule } from 'eslint';
import { staticJsx } from './rules/static-jsx/index.js';

const plugin: ESLint.Plugin = {
  meta: {
    name: '@generaltranslation/react-core-linter',
    version: '0.0.0',
  },
  rules: {
    'static-jsx': staticJsx as unknown as Rule.RuleModule,
  },
  configs: {
    recommended: {
      plugins: ['@generaltranslation/react-core-linter'],
      rules: {
        '@generaltranslation/react-core-linter/static-jsx': 'error',
      },
    },
  },
};

export default plugin;
