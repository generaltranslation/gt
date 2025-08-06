/**
 * GT-Next ESLint Plugin
 *
 * Provides ESLint rules for General Translation Next.js integration.
 * This plugin detects unwrapped dynamic content in translation components
 * and provides better error reporting with file locations and line numbers.
 */

import { noDynamicJsx } from './rules/no-dynamic-jsx';
import { noDynamicString } from './rules/no-dynamic-string';
import { recommended } from './configs/recommended';

const plugin = {
  meta: {
    name: '@generaltranslation/gt-next-lint',
    version: '1.0.0',
  },
  rules: {
    'no-dynamic-jsx': noDynamicJsx,
    'no-dynamic-string': noDynamicString,
  },
  configs: {
    recommended,
  },
};

export = plugin;
