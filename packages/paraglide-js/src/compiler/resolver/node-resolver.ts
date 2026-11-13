import path from 'node:path';
import { ResolverFactory } from 'oxc-resolver';
import {
  aliasEntries,
  applyAliases,
  type AliasOption,
  type ImportAlias,
} from '../bundler-configs/alias.js';
import type { Resolver } from '../collector/collector.js';

/**
 * What `nodeResolver` does, as the analysis can do it itself, off the main
 * thread: the same resolution, without a call per import.
 */
export type NativeResolution = {
  /** How imports are resolved. */
  options(): Promise<{
    aliases: readonly ImportAlias[];
    rootDirectory: string | undefined;
    conditions: readonly string[];
  }>;
  /** Told of the imports that did not resolve. */
  unresolved?(specifier: string, importer: string): void;
};

/** By resolver: those that `nodeResolver` and `ProjectResolver` made. */
const nativeResolutions = new WeakMap<Resolver, NativeResolution>();

/** Marks `resolver` as doing what `resolution` describes, and nothing else. */
export function describeResolver(
  resolver: Resolver,
  resolution: NativeResolution
): Resolver {
  nativeResolutions.set(resolver, resolution);

  return resolver;
}

/** How to resolve like `resolver` without calling it; undefined for any other function. */
export function nativeResolution(
  resolver: Resolver
): NativeResolution | undefined {
  return nativeResolutions.get(resolver);
}

export const DEFAULT_CONDITIONS = ['import', 'module', 'browser', 'default'];

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
  const conditions = options.conditions ?? DEFAULT_CONDITIONS;
  const factory = new ResolverFactory({
    tsconfig: 'auto',
    conditionNames: conditions,
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

  const resolve: Resolver = async (specifier, importer) => {
    const aliased = applyAliases(specifier, aliases);
    const inRoot = rootPath(aliased, options.rootDirectory);
    const file = inRoot && (await resolveFile(inRoot, importer));

    return file ?? resolveFile(aliased, importer);
  };

  return describeResolver(resolve, {
    options: async () => ({
      aliases,
      rootDirectory: options.rootDirectory,
      conditions,
    }),
  });
}

/** `/src/a.js` → `<rootDirectory>/src/a.js` */
function rootPath(
  specifier: string,
  rootDirectory: string | undefined
): string | undefined {
  if (!rootDirectory || !specifier.startsWith('/')) return undefined;

  return path.join(rootDirectory, specifier);
}
