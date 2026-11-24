import type { MessageTree, MessageFormats } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { buildSiteMessage } from './buildMessage';
import type { CheckHoles } from './placeholders';
import {
  isPrecomputedMessage,
  type LookupTreeTranslation,
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

// Marks lookupCachedTranslation, whose default-locale reads skip the lookup
// once the I18nCache exists.
export const CACHED = '_gtCacheInitialized';
export type CachedLookup = { [CACHED]?: () => boolean };

export function isTemplateStringsArray(
  value: unknown
): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value;
}
