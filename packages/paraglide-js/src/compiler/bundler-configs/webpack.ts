import { pathToFileURL } from 'node:url';
import { isJsonObject } from '../utils/json.js';
import { escapeRegExp } from '../utils/regexp.js';
import type { ImportAlias } from './alias.js';
import { configFileNames, type BundlerConfig } from './bundler-config.js';

type AliasEntry = [name: string, target: unknown];

/** For a config that is a function: no env, a production build. */
const CONFIG_ARGUMENTS = [{}, { mode: 'production' }] as const;

export const webpackConfig = webpackLikeConfig('webpack', 'webpack.config');
export const rspackConfig = webpackLikeConfig('rspack', 'rspack.config');

/**
 * `resolve.alias` of a config in webpack's format. The file is imported as it
 * is, so a TypeScript one needs a Node.js that runs TypeScript.
 */
export function webpackLikeConfig(
  name: string,
  baseName: string
): BundlerConfig {
  return {
    name,
    files: configFileNames(baseName),
    async read(file) {
      const config = await loadConfig(file);
      if (!isJsonObject(config)) return { error: 'it exports no config' };

      const resolve = isJsonObject(config.resolve) ? config.resolve : {};

      return { aliases: importAliases(resolve.alias) };
    },
  };
}

/** The export: a config, a function returning one, or a list of either (the first counts). */
async function loadConfig(file: string): Promise<unknown> {
  const module: { default?: unknown } = await import(pathToFileURL(file).href);
  const exported = module.default ?? module;
  const first: unknown = Array.isArray(exported) ? exported[0] : exported;

  return typeof first === 'function' ? first(...CONFIG_ARGUMENTS) : first;
}

function importAliases(alias: unknown): ImportAlias[] {
  return aliasEntries(alias).flatMap(([name, target]) => {
    const replacement = firstTarget(target);
    if (replacement === undefined) return [];

    const exact = name.endsWith('$');
    const find = exact ? name.slice(0, -1) : name;
    if (!exact && WILDCARD_NAME.test(find)) {
      return [wildcardAlias(find, replacement)];
    }

    return [{ find, replacement, exact }];
  });
}

/** A name with one `*`, which stands for any text: `@/*`. With more, webpack reads them as they are. */
const WILDCARD_NAME = /^[^*]*\*[^*]*$/;

/** `"@/*": "/app/src/*"` → `/^@\/(.*)$/` to `/app/src/$1` */
function wildcardAlias(name: string, target: string): ImportAlias {
  const [before, after] = name.split('*').map(escapeRegExp);
  const find = new RegExp(`^${before}(.*)${after}$`);

  return { find, replacement: wildcardReplacement(target) };
}

/**
 * The target as the replacement of a `String.replace`: its first `*` stands
 * for the match. Only the first: webpack leaves any later `*` as it is. A `$`
 * of the target is text, not a reference to the match.
 */
function wildcardReplacement(target: string): string {
  const asText = (text: string) => text.replaceAll('$', '$$$$');

  const star = target.indexOf('*');
  if (star === -1) return asText(target);

  const before = target.slice(0, star);
  const after = target.slice(star + 1);

  return `${asText(before)}$1${asText(after)}`;
}

/** `{ name: target }`, or `[{ name, alias, onlyModule }]` where `onlyModule` is `name$`. */
function aliasEntries(alias: unknown): AliasEntry[] {
  if (isJsonObject(alias)) return Object.entries(alias);
  if (!Array.isArray(alias)) return [];

  return alias
    .filter(isJsonObject)
    .map((entry) => [
      `${String(entry.name)}${entry.onlyModule ? '$' : ''}`,
      entry.alias,
    ]);
}

/** A target is a path, a list of paths to try, or `false`. */
function firstTarget(target: unknown): string | undefined {
  const first: unknown = Array.isArray(target) ? target[0] : target;

  return typeof first === 'string' ? first : undefined;
}
