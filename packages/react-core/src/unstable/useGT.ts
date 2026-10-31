import { useEffect, useMemo, useRef } from 'react';
import type { GT } from 'gt-i18n/unstable';
import { getI18nConfig } from 'gt-i18n/internal';
import { createGT } from 'gt-i18n/unstable/internal';
import { useGTContext } from '../context/context';
import { useEnableI18n, useLocale } from '../hooks/condition-store';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';

/**
 * Returns a GT bound to the render locale. A new translations snapshot
 * changes the context and re-renders the caller. Trees are never sent for
 * runtime translation, so misses render the source.
 *
 * A `locale` option for a locale whose translations are not loaded suspends
 * the caller until they load into the I18nCache. Under a provider that
 * hydrates, an override reads only the provider's translations and otherwise
 * renders the source, so server and client always agree.
 *
 * @example
 * const gt = useGT();
 * gt`Hello, ${{ name }}!`;
 * gt({ locale: 'fr' })`Hello, ${{ name }}!`;
 */
export function useGT(): GT {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  const context = useGTContext();
  const translationsSnapshot = context?.translationsSnapshot;
  const canLoadOverrideLocales = context
    ? (context.canLoadOverrideLocales ?? false)
    : true;
  // The overrides read since this component last committed, across every
  // attempt at an unfinished update, including a re-run that reuses memoized
  // output and so does not read them again. A load it starts keeps them past
  // the retention limit. The shared override loads live outside React, so a
  // commit clears the set: a finished render's reads must not renew them.
  const readOverrideLocales = useRef(new Set<string>());
  useEffect(() => {
    readOverrideLocales.current.clear();
  });
  return useMemo(() => {
    const renderCacheLocale = resolveCacheLocale(locale);
    return createGT({
      getLocale: () => locale,
      getEnableI18n: () => enableI18n,
      lookupTranslation: (lookupLocale, hash) => {
        const cacheLocale = resolveCacheLocale(lookupLocale);
        if (!cacheLocale) return undefined;
        const snapshotTranslations = translationsSnapshot?.[cacheLocale];
        if (snapshotTranslations) return snapshotTranslations[hash];
        // Under a provider, read only its serialized snapshot: the
        // process-local cache, and any override load, can differ between
        // server and client and would break hydration. Providers that never
        // hydrate, such as React Native's, may load overrides.
        if (cacheLocale === renderCacheLocale) {
          return translationsSnapshot
            ? undefined
            : getReactI18nCache().lookupTranslationByHash(cacheLocale, hash);
        }
        return canLoadOverrideLocales
          ? readOverrideTranslation(
              cacheLocale,
              hash,
              readOverrideLocales.current
            )
          : undefined;
      },
    });
  }, [locale, enableI18n, translationsSnapshot, canLoadOverrideLocales]);
}

// Not shared with I18nCache's _resolveCacheLocale, which throws for an invalid
// locale: here an invalid override returns undefined and renders the source.
function resolveCacheLocale(locale: string): string | undefined {
  const i18nConfig = getI18nConfig();
  const resolvedLocale = i18nConfig.determineLocale(locale);
  if (resolvedLocale && i18nConfig.requiresTranslation(resolvedLocale)) {
    return resolvedLocale;
  }
  const aliasLocale = i18nConfig.resolveAliasLocale(
    i18nConfig.standardizeLocale(locale)
  );
  return i18nConfig.requiresTranslation(aliasLocale) ? aliasLocale : undefined;
}

/** How long a settled override load is reused before loading again. */
export const OVERRIDE_LOAD_RETRY_DELAY_MS = 5_000;

/**
 * How long loads from other GT instances can keep a settled override, counted
 * from when it settled. Without it, overlapping unrelated loads could keep a
 * failed load's `{}` forever and it would never retry.
 */
export const OVERRIDE_LOAD_MAX_RETENTION_MS = 30_000;

type OverrideLoadResult = {
  translations?: Record<string, unknown>;
  error?: { value: unknown };
};

type OverrideLoad =
  | { promise: Promise<void> }
  | (OverrideLoadResult & { settledAt: number; settledUntil: number });

// In-flight and recently settled override loads per I18nCache and cache
// locale. Suspense retries see the same promise during one attempt. Loaded
// translations are read from the I18nCache; the settled result is used only
// when the cache read misses (a cache that expired it, or the `{}` the cache
// resolves after logging a failed load), and only for the retry delay.
const overrideLoadsByCache = new WeakMap<object, Map<string, OverrideLoad>>();

/**
 * Reads a locale-override translation from the I18nCache, suspending the
 * caller while that locale loads. A rejected load throws its error until the
 * retry delay passes. `readLocales` collects the override locales read since
 * the calling component last committed.
 */
function readOverrideTranslation(
  cacheLocale: string,
  hash: string,
  readLocales: Set<string>
): unknown {
  readLocales.add(cacheLocale);
  const i18nCache = getReactI18nCache();
  if (i18nCache.hasTranslations(cacheLocale)) {
    return i18nCache.lookupTranslationByHash(cacheLocale, hash);
  }
  let loads = overrideLoadsByCache.get(i18nCache);
  if (!loads) {
    loads = new Map();
    overrideLoadsByCache.set(i18nCache, loads);
  }
  const load = loads.get(cacheLocale);
  if (load && 'promise' in load) throw load.promise;
  if (load && Date.now() < load.settledUntil) {
    if (load.error) throw load.error.value;
    return load.translations?.[hash];
  }
  // A render may wait on several overrides in turn, so this load keeps the
  // ones still current when it started until that render can use them: with
  // no limit those read since the component last committed, otherwise up to
  // the retention limit. Siblings and later renders read their own, so a
  // chain across them keeps the limit. Rejected loads keep their own deadline so they retry on time.
  const now = Date.now();
  const pinned = [...loads].flatMap(([otherLocale, other]) =>
    'settledUntil' in other && now < other.settledUntil && !other.error
      ? [{ locale: otherLocale, capped: !readLocales.has(otherLocale) }]
      : []
  );
  const settle = (result: OverrideLoadResult) => {
    const settledAt = Date.now();
    const settledUntil = settledAt + OVERRIDE_LOAD_RETRY_DELAY_MS;
    for (const { locale: otherLocale, capped } of pinned) {
      const other = loads.get(otherLocale);
      if (other && 'settledUntil' in other) {
        loads.set(otherLocale, {
          ...other,
          settledUntil: capped
            ? Math.min(
                settledUntil,
                other.settledAt + OVERRIDE_LOAD_MAX_RETENTION_MS
              )
            : settledUntil,
        });
      }
    }
    loads.set(cacheLocale, { ...result, settledAt, settledUntil });
  };
  const promise = i18nCache.loadTranslations(cacheLocale).then(
    (translations) => settle({ translations }),
    (value: unknown) => settle({ error: { value } })
  );
  loads.set(cacheLocale, { promise });
  throw promise;
}
