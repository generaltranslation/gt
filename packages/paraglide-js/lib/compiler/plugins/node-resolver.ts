import path from 'node:path';
import { ResolverFactory } from 'oxc-resolver';
import {
  aliasEntries,
  applyAliases,
  type AliasOption,
} from '../bundler-configs/alias.js';
import type { Resolver } from '../collector/collector.js';

export type NodeResolverOptions = {
  /** Like a bundler's `resolve.alias`: `{ "~": "/abs/src" }` or a list. */
  alias?: AliasOption;
  /** Where `/src/a.js` resolves from, like Vite's root. */
  rootDirectory?: string;
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
 * Resolves like a bundler without one: aliases, package `exports` and
 * `imports`, tsconfig `paths` (from the nearest tsconfig.json of each
 * importer), and TypeScript's `./a.js` → `./a.ts`.
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
  });
  const aliases = aliasEntries(options.alias);
  const resolveFile: Resolver = async (specifier, importer) =>
    (await factory.resolveFileAsync(importer, specifier)).path;

  return async (specifier, importer) => {
    const aliased = applyAliases(specifier, aliases);
    const inRoot = rootPath(aliased, options.rootDirectory);
    const file = inRoot && (await resolveFile(inRoot, importer));

    return file ?? resolveFile(aliased, importer);
  };
}

/** `/src/a.js` → `<rootDirectory>/src/a.js` */
function rootPath(
  specifier: string,
  rootDirectory: string | undefined
): string | undefined {
  if (!rootDirectory || !specifier.startsWith('/')) return undefined;

  return path.join(rootDirectory, specifier);
}
