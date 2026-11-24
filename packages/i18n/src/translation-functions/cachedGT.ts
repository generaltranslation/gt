import type { MessageTree } from '@generaltranslation/icu';
import { getWritableConditionStore } from '../condition-store/singleton-operations';
import {
  getI18nCache,
  isI18nCacheInitialized,
} from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { isDevHotReloadEnabled } from '../i18n-config/isDevHotReloadEnabled';
import { CACHED, createGT, type CreateGTParams, type GT } from './gt';
import {
  type LookupTreeTranslation,
  type MessageTreeLookupOptions,
  type PrecomputedMessage,
  renderPrecomputedMessage,
} from './renderMessage';
import type { MessageFormats } from '@generaltranslation/icu';

// The GT functions that read the I18nCache, kept apart from createGT so a
// bundle that never reads the cache leaves it out.

/** Loads the locale's translations, then returns a GT bound to that locale. */
export async function getGT(conditions: {
  locale: string;
  enableI18n: boolean;
}): Promise<GT> {
  return createGT(await loadCreateGTParams(conditions));
}

/** Loads the locale's translations, then returns params bound to that locale. */
export async function loadCreateGTParams({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): Promise<CreateGTParams> {
  const cache = getI18nCache();
  const boundLocale = enableI18n ? locale : getI18nConfig().getDefaultLocale();
  // Keeps the loaded locale even after its cache entry expires.
  const lookupTranslation = await cache.getLookupTranslation(boundLocale);
  return {
    getLocale: () => locale,
    getEnableI18n: () => enableI18n,
    lookupTranslation: withDevHotReload(lookupTranslation, (tree, options) =>
      // Every lookup is in the bound locale, so a miss goes into the kept
      // cache that later lookups read, even after the global entry expires.
      lookupTranslation.prefetchEntries
        ? lookupTranslation.prefetchEntries([{ content: tree, options }])
        : translateMiss(tree, options)
    ),
  };
}

function translateMiss(
  tree: MessageTree,
  options: MessageTreeLookupOptions
): Promise<unknown> {
  return getI18nCache().lookupTranslationWithFallback(
    options.$locale,
    tree,
    options
  );
}

/**
 * A miss in dev hot reload is sent for runtime translation, which later
 * lookups read.
 */
function withDevHotReload(
  lookupTranslation: LookupTreeTranslation,
  translate = translateMiss
): LookupTreeTranslation {
  return (tree, options) => {
    const translation = lookupTranslation(tree, options);
    // Statically gated so bundlers drop it from production builds.
    if (
      process.env.NODE_ENV !== 'production' &&
      translation == null &&
      isDevHotReloadEnabled()
    ) {
      void translate(tree, options).catch(() => {});
    }
    return translation;
  };
}

/**
 * Reads the I18nCache; in dev hot reload a miss is sent for runtime
 * translation, which later lookups read.
 */
export const lookupCachedTranslation: LookupTreeTranslation =
  /* @__PURE__ */ createCachedLookup();

function createCachedLookup(): LookupTreeTranslation {
  return Object.assign(
    withDevHotReload((tree, options) =>
      getI18nCache().lookupTranslation(options.$locale, tree, options)
    ),
    { [CACHED]: isI18nCacheInitialized }
  );
}

/**
 * Renders a precomputed message from the I18nCache, as the GT of a createGT()
 * without `lookupTranslation` does once it has read `locale` and `enabled`;
 * a disabled caller passes the default locale.
 */
export function renderCachedMessage(
  site: PrecomputedMessage,
  values: Record<string, unknown> | undefined,
  formats: MessageFormats | undefined,
  locale: string,
  enabled: boolean
): string {
  return renderPrecomputedMessage(
    site,
    values,
    formats,
    locale,
    enabled,
    lookupCachedTranslation,
    isI18nCacheInitialized
  );
}

/** Global GT reading the current locale from the condition store. */
export const t: GT = /* @__PURE__ */ createGT({
  getLocale: () => getWritableConditionStore().getLocale(),
  getEnableI18n: () => getWritableConditionStore().getEnableI18n(),
  lookupTranslation: lookupCachedTranslation,
});
