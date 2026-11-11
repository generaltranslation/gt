/** An entry of a bundler's `resolve.alias`. */
export type ImportAlias = {
  /** A string matches `find` and `find/…`. */
  find: string | RegExp;
  replacement: string;
  /** A string matches only `find` itself (webpack's `name$`). */
  exact?: boolean;
};

/** e.g. `{ "~": "/app/src" }` */
export type AliasOption =
  | Readonly<Record<string, string>>
  | readonly ImportAlias[];

export function aliasEntries(alias: AliasOption = []): ImportAlias[] {
  if (isAliasList(alias)) return [...alias];

  return Object.entries(alias).map(([find, replacement]) => ({
    find,
    replacement,
  }));
}

/** `~/a.js` → `/app/src/a.js`. The first match wins. */
export function applyAliases(
  specifier: string,
  aliases: readonly ImportAlias[]
): string {
  const alias = aliases.find((candidate) => matches(candidate, specifier));
  if (!alias) return specifier;

  const { find, replacement } = alias;
  if (find instanceof RegExp) return specifier.replace(find, replacement);

  return replacement + specifier.slice(find.length);
}

function isAliasList(alias: AliasOption): alias is readonly ImportAlias[] {
  return Array.isArray(alias);
}

function matches({ find, exact }: ImportAlias, specifier: string): boolean {
  if (find instanceof RegExp) return specifier.search(find) !== -1;
  if (specifier === find) return true;

  return !exact && specifier.startsWith(`${find}/`);
}
