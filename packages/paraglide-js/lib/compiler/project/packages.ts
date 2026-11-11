import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LanguageContext } from '../languages/language.js';
import { resolvePackage } from '../utils/resolve-package.js';

/**
 * Imports packages installed in the project, once each; undefined if one is
 * not installed.
 *
 * A tool the project does not depend on itself is often a dependency of its
 * dependencies: `svelte2tsx` of `svelte-check` or `@astrojs/svelte`,
 * `@vue/language-core` of `vue-tsc`, `@astrojs/astro2tsx` of `@astrojs/check`'s
 * language server. Strict installs (pnpm) hide those from the project, so they
 * are looked up two dependency levels deep too.
 */
export function projectPackages(projectRoot: string): LanguageContext {
  const loaded = new Map<string, Promise<unknown>>();
  let levels: Promise<string[][]> | undefined;
  const find = async (specifier: string): Promise<string | undefined> => {
    const direct = await resolvePackage(projectRoot, specifier);
    if (direct) return direct;
    levels ??= dependencyLevels(projectRoot, 2);
    for (const level of await levels) {
      for (const directory of level) {
        const file = await resolvePackage(directory, specifier);
        if (file) return file;
      }
    }
    return undefined;
  };
  return {
    load<T>(specifier: string): Promise<T | undefined> {
      let module = loaded.get(specifier);
      if (!module) {
        module = (async () => {
          const file = await find(specifier);
          const module =
            file &&
            (await import(pathToFileURL(file).href).catch(() => undefined));
          return withDefaultExports(module);
        })();
        loaded.set(specifier, module);
      }
      return module as Promise<T | undefined>;
    },
  };
}

/** A CommonJS module's exports, also as named exports: `parse`, not only `default.parse`. */
function withDefaultExports(module: unknown): unknown {
  if (typeof module !== 'object' || module === null) return module;
  const fallback = (module as { default?: unknown }).default;
  return typeof fallback === 'object' && fallback !== null
    ? { ...(fallback as object), ...(module as object) }
    : module;
}

/**
 * The installed directories of the project's dependencies (and devDependencies),
 * then of theirs, up to `depth` levels: `@astrojs/check` → `@astrojs/language-server`
 * → `@astrojs/astro2tsx` is two.
 */
async function dependencyLevels(
  projectRoot: string,
  depth: number
): Promise<string[][]> {
  const seen = new Set<string>();
  const levels: string[][] = [];
  let current = await dependencyDirectories(projectRoot, true);
  for (let level = 0; level < depth && current.length > 0; level++) {
    const fresh = current.filter((directory) => !seen.has(directory));
    for (const directory of fresh) seen.add(directory);
    levels.push(fresh);
    current = (
      await Promise.all(fresh.map((d) => dependencyDirectories(d, false)))
    ).flat();
  }
  return levels;
}

/** The directories of a package's dependencies, as Node would find them from it. */
async function dependencyDirectories(
  packageDirectory: string,
  dev: boolean
): Promise<string[]> {
  const manifest = await fs
    .readFile(path.join(packageDirectory, 'package.json'), 'utf8')
    .then(
      (json) =>
        JSON.parse(json) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
    )
    .catch(() => undefined);
  const names = Object.keys({
    ...manifest?.dependencies,
    ...(dev ? manifest?.devDependencies : {}),
  });
  const directories = await Promise.all(
    names.map((name) => findPackage(packageDirectory, name))
  );
  return directories.filter(
    (directory): directory is string => directory !== undefined
  );
}

/** `node_modules/<name>` in `from` or a directory above it (pnpm's store layout too). */
async function findPackage(
  from: string,
  name: string
): Promise<string | undefined> {
  for (let directory = from; ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', ...name.split('/'));
    const real = await fs.realpath(candidate).catch(() => undefined);
    if (real) return real;
    if (path.dirname(directory) === directory) return undefined;
  }
}
