import type { Content } from '@generaltranslation/format/types';
import { getI18nCache } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';

type Translations = Record<string, Content>;
type Cache = ReturnType<typeof getI18nCache>;

/** Where a translations object is cached, and how to check it still is. */
type CachedEntry = {
  cache: Cache;
  locale: string;
  /** The locale's version when the translations were cached. */
  version: number;
  /** One of the translations and its cached value. */
  hash: string;
  value: unknown;
};

const cachedTranslations = new WeakMap<Translations, CachedEntry>();

/** Per locale, how many times translations were added to the cache. */
const versions = new Map<string, number>();

/** Records that `translations` were just loaded from the cache. */
export function rememberCachedTranslations(
  locale: string,
  translations: Translations
): void {
  const hash = firstKey(translations);
  if (hash === undefined) return;
  const cache = getI18nCache();
  const value = lookup(cache, locale, hash);
  if (value == null) return;
  cachedTranslations.set(translations, {
    cache,
    locale,
    version: versions.get(locale) ?? 0,
    hash,
    value,
  });
}

/** Records that `translations` were just added to the cache. */
export function rememberAddedTranslations(
  locale: string,
  translations: Translations
): void {
  versions.set(locale, (versions.get(locale) ?? 0) + 1);
  rememberCachedTranslations(locale, translations);
}

/**
 * Whether the cache still holds `translations` for `locale`: nothing was
 * added to the locale since, and the locale's translations did not expire.
 */
export function hasCachedTranslations(
  locale: string,
  translations: Translations
): boolean {
  const entry = cachedTranslations.get(translations);
  if (!entry) return false;
  const cache = getI18nCache();
  return (
    entry.cache === cache &&
    entry.locale === locale &&
    entry.version === (versions.get(locale) ?? 0) &&
    lookup(cache, locale, entry.hash) === entry.value
  );
}

function lookup(cache: Cache, locale: string, hash: string): unknown {
  return cache.lookupTranslation(locale, null, {
    $format: 'JSX',
    $_hash: hash,
  } as LookupOptions);
}

function firstKey(translations: Translations): string | undefined {
  for (const key in translations) return key;
  return undefined;
}
