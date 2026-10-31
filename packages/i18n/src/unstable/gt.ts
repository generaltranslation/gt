import type { MessageTree } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { getWritableConditionStore } from '../condition-store/singleton-operations';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { buildMessage } from './buildMessage';
import type { CheckHoles } from './placeholders';
import {
  type LookupTreeTranslation,
  type MessageTreeLookupOptions,
  type MessageTreeMetadata,
  renderMessage,
} from './renderMessage';

/**
 * Translation key metadata plus a locale override. `context` disambiguates
 * identical text; a negative `maxChars` keeps the end of the text.
 */
export type GTOptions = MessageTreeHashMetadata & {
  /** Overrides the current locale for this message. */
  locale?: string;
};

type GTTag = <const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H>
) => string;

/** gt`...` or gt({ context })`...` */
export type GT = GTTag & ((options: GTOptions) => GTTag);

export type CreateGTParams = {
  getLocale: () => string;
  getEnableI18n?: () => boolean;
  /**
   * Reads a tree's catalog entry, e.g. from a framework's translations
   * snapshot. Results are validated like I18nCache entries. Defaults to the
   * I18nCache, with dev hot reload translating misses.
   */
  lookupTranslation?: LookupTreeTranslation;
};

/**
 * Creates a GT that resolves translations synchronously from the I18nCache.
 * The locale must already be loaded (see getGT) for translations to apply.
 */
export function createGT({
  getLocale,
  getEnableI18n,
  lookupTranslation = withDevHotReload((message, options) =>
    getI18nCache().lookupTranslation(options.$locale, message, options)
  ),
}: CreateGTParams): GT {
  const render = (
    options: GTOptions & Pick<MessageTreeMetadata, '$_hash'>,
    strings: TemplateStringsArray,
    holes: unknown[]
  ): string => {
    const { tree, values } = buildMessage(strings, holes);
    const enabled = getEnableI18n?.() ?? true;
    const locale = enabled
      ? (options.locale ?? getLocale())
      : getI18nConfig().getDefaultLocale();
    // Disabled skips every lookup, including custom ones with default-locale entries.
    const lookup = enabled ? lookupTranslation : () => undefined;
    return renderMessage(tree, values, locale, options, lookup);
  };
  const gt = (first: TemplateStringsArray | GTOptions, ...holes: unknown[]) =>
    isTemplateStringsArray(first)
      ? render({}, first, holes)
      : (strings: TemplateStringsArray, ...nested: unknown[]) =>
          render(first, strings, nested);
  return gt as GT;
}

/** Loads the locale's translations, then returns a GT bound to that locale. */
export async function getGT({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): Promise<GT> {
  // Keeps the loaded locale even after its cache entry expires.
  const lookupTranslation = await getI18nCache().getLookupTranslation(
    enableI18n ? locale : getI18nConfig().getDefaultLocale()
  );
  return createGT({
    getLocale: () => locale,
    getEnableI18n: () => enableI18n,
    lookupTranslation: withDevHotReload(lookupTranslation, (message, options) =>
      // A miss in this locale goes into the cache kept above, which the
      // global one replaces once it expires.
      options.$locale === locale && lookupTranslation.prefetchEntries
        ? lookupTranslation.prefetchEntries([{ message, options }])
        : translateMiss(message, options)
    ),
  });
}

function translateMiss(
  message: MessageTree,
  options: MessageTreeLookupOptions
): Promise<unknown> {
  return getI18nCache().lookupTranslationWithFallback(
    options.$locale,
    message,
    options
  );
}

/**
 * Like legacy lookups, a miss in dev hot reload is sent for runtime
 * translation, which later lookups read.
 */
function withDevHotReload(
  lookupTranslation: LookupTreeTranslation,
  translate = translateMiss
): LookupTreeTranslation {
  return (message, options) => {
    const translation = lookupTranslation(message, options);
    // Statically gated so bundlers drop it from production builds.
    if (
      process.env.NODE_ENV !== 'production' &&
      translation == null &&
      getI18nConfig().isDevHotReloadEnabled()
    ) {
      void translate(message, options).catch(() => {});
    }
    return translation;
  };
}

/** Global GT reading the current locale from the condition store. */
export const t: GT = /* @__PURE__ */ createGT({
  getLocale: () => getWritableConditionStore().getLocale(),
  getEnableI18n: () => getWritableConditionStore().getEnableI18n(),
});

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value;
}
