import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LanguageContext } from '../languages/language.js';
import { isJsonObject, readJsonObject } from '../utils/json.js';
import {
  packageManifest,
  resolvePackage,
  versionOf,
} from '../utils/resolve-package.js';

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
export type ProjectPackages = LanguageContext & {
  /** See `packageVersions`: of the package `name` that `load` imports. */
  versions(name: string): Promise<string[]>;
};

export function projectPackages(projectRoot: string): ProjectPackages {
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

  const importPackage = async (specifier: string): Promise<unknown> => {
    const file = await find(specifier);
    if (!file) return undefined;

    const module: unknown = await import(pathToFileURL(file).href).catch(
      () => undefined
    );

    return withDefaultExports(module);
  };

  return {
    load<T>(specifier: string): Promise<T | undefined> {
      let module = loaded.get(specifier);

      if (!module) {
        module = importPackage(specifier);
        loaded.set(specifier, module);
      }

      return module as Promise<T | undefined>;
    },

    async versions(name: string): Promise<string[]> {
      return packageVersions(await find(name), name);
    },
  };
}

/**
 * `name@version` of the package `name` that holds `file`, then of each of
 * its dependencies as it loads them: a new version of one can change what
 * the package does as much as its own.
 */
export async function packageVersions(
  file: string | undefined,
  name: string
): Promise<string[]> {
  const found = file && (await packageManifest(file, name));
  if (!found) return [`${name}@none`];

  const { directory, manifest } = found;
  const dependencies = isJsonObject(manifest.dependencies)
    ? Object.keys(manifest.dependencies).sort()
    : [];

  const versions = await Promise.all(
    dependencies.map(async (dependency) => {
      const installed = await findPackage(directory, dependency);
      const installedManifest =
        installed &&
        (await readJsonObject(path.join(installed, 'package.json')));

      return `${dependency}@${installedManifest ? versionOf(installedManifest) : 'none'}`;
    })
  );

  return [`${name}@${versionOf(manifest)}`, ...versions];
}

/** A CommonJS module's exports, also as named exports: `parse`, not only `default.parse`. */
function withDefaultExports(module: unknown): unknown {
  if (!isObject(module)) return module;

  const fallback = (module as { default?: unknown }).default;
  if (!isObject(fallback)) return module;

  return { ...fallback, ...module };
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
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

    // Not past the last level: it is not returned.
    if (level + 1 === depth) break;

    current = (
      await Promise.all(
        fresh.map((directory) => dependencyDirectories(directory, false))
      )
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
export async function findPackage(
  from: string,
  name: string
): Promise<string | undefined> {
  for (let directory = from; ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', ...name.split('/'));
    const real = await fs.realpath(candidate).catch(() => undefined);
    if (real) return real;

    const isFilesystemRoot = path.dirname(directory) === directory;
    if (isFilesystemRoot) return undefined;
  }
}
