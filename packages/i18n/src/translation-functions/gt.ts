import type { MessageTree, MessageFormats } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { getWritableConditionStore } from '../condition-store/singleton-operations';
import {
  getI18nCache,
  isI18nCacheInitialized,
} from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { buildSiteMessage } from './buildMessage';
import type { CheckHoles } from './placeholders';
import {
  isPrecomputedMessage,
  type LookupTreeTranslation,
  type MessageTreeLookupOptions,
  type MessageTreeMetadata,
  type PrecomputedMessage,
  renderMessage,
  renderPrecomputedMessage,
} from './renderMessage';

/**
 * Translation key metadata. `context` disambiguates identical text; a
 * negative `maxChars` keeps the end of the text.
 */
export type GTOptions = MessageTreeHashMetadata;

type GTTag = <const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H>
) => string;

/** t`...` or t({ context })`...` */
export type GT = GTTag & ((options: GTOptions) => GTTag);

export type CreateGTParams = {
  getLocale: () => string;
  getEnableI18n?: () => boolean;
  /**
   * Reads a tree's catalog entry, e.g. from a framework's translations
   * snapshot or lookupCachedTranslation. Results are validated like I18nCache
   * entries. Required, so a bundle that never reads the I18nCache leaves it
   * out.
   */
  lookupTranslation: LookupTreeTranslation;
};

/** Renders a built tree, as a GT or an m does. */
export type RenderTree = (
  tree: MessageTree,
  values: Record<string, unknown>,
  formats: MessageFormats,
  options: MessageTreeMetadata
) => string;

/**
 * The render path shared by createGT and createMessages: resolves the locale,
 * looks up the tree's translation and renders it.
 */
export function createRenderTree({
  getLocale,
  getEnableI18n,
  lookupTranslation,
}: CreateGTParams): RenderTree {
  return (tree, values, formats, options) => {
    const enabled = getEnableI18n?.() ?? true;
    const locale = enabled ? getLocale() : getI18nConfig().getDefaultLocale();
    // Disabled skips every lookup, including custom ones with default-locale entries.
    const lookup = enabled ? lookupTranslation : () => undefined;
    return renderMessage(tree, values, formats, locale, options, lookup);
  };
}

/**
 * Creates a GT that resolves translations synchronously from the I18nCache.
 * The locale must already be loaded (see getGT) for translations to apply.
 */
export function createGT(params: CreateGTParams): GT {
  const renderTree = createRenderTree(params);
  const { getLocale, getEnableI18n, lookupTranslation } = params;
  const isCacheInitialized = (lookupTranslation as CachedLookup)[CACHED];
  const render = (
    options: GTOptions & Pick<MessageTreeMetadata, '$_hash'>,
    strings: TemplateStringsArray,
    holes: unknown[]
  ): string => {
    const { tree, values, formats, metadata } = buildSiteMessage(
      strings,
      holes,
      options
    );
    return renderTree(tree, values, formats, metadata);
  };
  const gt = (
    first: TemplateStringsArray | GTOptions | PrecomputedMessage,
    ...holes: unknown[]
  ) => {
    // A compiler passes the call site's precomputed message with its values.
    if (isPrecomputedMessage(first)) {
      const enabled = getEnableI18n?.() ?? true;
      return renderPrecomputedMessage(
        first,
        holes[0] as Record<string, unknown> | undefined,
        holes[1] as MessageFormats | undefined,
        enabled ? getLocale() : getI18nConfig().getDefaultLocale(),
        enabled,
        lookupTranslation,
        isCacheInitialized
      );
    }
    return isTemplateStringsArray(first)
      ? render({}, first, holes)
      : (strings: TemplateStringsArray, ...nested: unknown[]) =>
          render(first, strings, nested);
  };
  return gt as GT;
}

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
      getI18nConfig().isDevHotReloadEnabled()
    ) {
      void translate(tree, options).catch(() => {});
    }
    return translation;
  };
}

// Marks lookupCachedTranslation, whose default-locale reads skip the lookup
// once the I18nCache exists.
const CACHED = '_gtCacheInitialized';
type CachedLookup = { [CACHED]?: () => boolean };

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

export function isTemplateStringsArray(
  value: unknown
): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value;
}
