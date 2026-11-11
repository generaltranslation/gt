import { ResolverFactory } from 'oxc-resolver';
import type { Resolver } from '../collector/collector.js';

export type NodeResolverOptions = {
  /** Like a bundler's `resolve.alias`: `{ "~": "/abs/src" }`. */
  alias?: Record<string, string>;
  /** Default: `["import", "module", "browser", "default"]`. */
  conditions?: string[];
};

const EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.vue',
  '.svelte',
  '.astro',
  '.mdx',
  '.marko',
  '.gjs',
  '.gts',
];

/**
 * Resolves like a bundler without one: package `exports` and `imports`,
 * tsconfig `paths` (from the nearest tsconfig.json of each importer), and
 * TypeScript's `./a.js` → `./a.ts`.
 */
export function nodeResolver(options: NodeResolverOptions = {}): Resolver {
  const factory = new ResolverFactory({
    tsconfig: 'auto',
    conditionNames: options.conditions ?? [
      'import',
      'module',
      'browser',
      'default',
    ],
    mainFields: ['browser', 'module', 'main'],
    extensions: EXTENSIONS,
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
    alias: Object.fromEntries(
      Object.entries(options.alias ?? {}).map(([find, replacement]) => [
        find,
        [replacement],
      ])
    ),
  });
  return async (specifier, importer) => {
    const result = await factory.resolveFileAsync(importer, specifier);
    return result.path;
  };
}
