/**
 * GT-Next ESLint Plugin
 *
 * Provides ESLint rules for General Translation Next.js integration.
 * This plugin detects unwrapped dynamic content in translation components
 * and provides better error reporting with file locations and line numbers.
 */

import { noUnwrappedDynamicContent } from './rules/no-unwrapped-dynamic-content';
import { noDynamicTranslationStrings } from './rules/no-dynamic-translation-strings';
import { recommended } from './configs/recommended';

const plugin = {
  meta: {
    name: '@generaltranslation/gt-next-lint',
    version: '1.0.0',
  },
  rules: {
    'no-unwrapped-dynamic-content': noUnwrappedDynamicContent,
    'no-dynamic-translation-strings': noDynamicTranslationStrings,
  },
  configs: {
    recommended,
  },
};

export = plugin;