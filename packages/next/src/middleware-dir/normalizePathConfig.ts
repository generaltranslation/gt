import { standardizeLocale } from '@generaltranslation/format';
import type { PathConfig as LocalizedPathConfig } from './createPathMatcher';

type LocalePathConfig = string | { path?: string; override?: boolean };

export type PathConfig = Record<
  string,
  string | Record<string, LocalePathConfig>
>;

/** Separates public path configuration into localized paths and page overrides. */
export function normalizePathConfig(
  input: PathConfig,
  standardizeLocales: boolean
) {
  const pathConfig: LocalizedPathConfig = {};
  const routeOverrides: Record<string, string[]> = {};

  for (const [sharedPath, value] of Object.entries(input)) {
    // Case 1: Path is just string
    if (typeof value === 'string') {
      pathConfig[sharedPath] = value;
      continue;
    }

    // Resolve duplicate locale spellings before splitting their path and override.
    const localeEntries = Object.fromEntries(
      Object.entries(value).map(([locale, entry]) => [
        standardizeLocales ? standardizeLocale(locale) : locale,
        entry,
      ])
    );

    // Case 2: object
    const localizedPaths: Record<string, string> = {};
    for (const [locale, value] of Object.entries(localeEntries)) {
      const entry = typeof value === 'string' ? { path: value } : value;
      const override = entry.override === true;

      // Option A (non-exclusive): Just a localized path
      if (
        entry.path !== undefined &&
        !(override && entry.path === sharedPath)
      ) {
        localizedPaths[locale] = entry.path;
      }

      // Option B (non-exclusive): Override
      if (override) (routeOverrides[locale] ??= []).push(sharedPath);
    }

    // An override alone must not add a route to the localization matcher.
    // Explicit legacy empty maps still register their shared route.
    if (
      Object.keys(localizedPaths).length > 0 ||
      Object.keys(value).length === 0
    ) {
      pathConfig[sharedPath] = localizedPaths;
    }
  }

  return { pathConfig, routeOverrides };
}
