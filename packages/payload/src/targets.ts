import type { TranslateTarget } from './types.js';

// A string naming one document, for maps and comparisons.
export const targetKey = (target: TranslateTarget): string =>
  'global' in target
    ? `global:${target.global}`
    : `${target.collection}:${target.id}`;
