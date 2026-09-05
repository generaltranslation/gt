import type { NextConfig } from 'next';

type TurbopackRules = NonNullable<NextConfig['turbopack']>['rules'];

const sourcePattern = '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,md,mdx}';

/** Run after user loaders so JSX emitted by those loaders receives the marker. */
export function addAutoJsxLayerLoader(
  rules: TurbopackRules,
  loader: string
): TurbopackRules {
  let pattern = sourcePattern;
  // A duplicate alternative matches the same files while giving our last rule
  // its own key. Moving or extending a user's rule could reorder their loaders.
  while (rules && Object.prototype.hasOwnProperty.call(rules, pattern)) {
    pattern = pattern.replace('}', ',jsx}');
  }
  const ownRule = { condition: { not: 'foreign' }, loaders: [loader] };
  return {
    ...rules,
    [pattern]: ownRule,
  } as TurbopackRules;
}
