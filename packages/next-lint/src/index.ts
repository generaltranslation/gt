/**
 * GT-Next ESLint Plugin
 *
 * Provides ESLint rules for General Translation Next.js integration.
 * This plugin detects unwrapped dynamic content in translation components
 * and provides better error reporting with file locations and line numbers.
 */

import { noUnwrappedDynamicContent } from './rules/no-unwrapped-dynamic-content';
import { recommended } from './configs/recommended';

const plugin = {
  meta: {
    name: '@generaltranslation/gt-next-lint',
    version: '1.0.0',
  },
  rules: {
    'no-unwrapped-dynamic-content': noUnwrappedDynamicContent,
  },
  configs: {
    recommended,
  },
};

export = plugin;