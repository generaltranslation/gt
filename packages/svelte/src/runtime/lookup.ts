import type { JsxChildren } from '@generaltranslation/format/types';
import { getI18nCache, getI18nConfig } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type { GTState } from './state.svelte';

/** Static `<T>` props forwarded to translation lookups. */
export type TranslationProps = {
  _hash: string;
  _source?: JsxChildren;
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

/** Whether content in this locale is translated rather than shown as source. */
export function requiresTranslation(locale: string): boolean {
  return getI18nConfig().requiresTranslation(locale);
}

/** Whether missing translations may be requested at runtime. */
export function isDevHotReloadEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled()
  );
}

/**
 * Looks up a `<T>` translation by its precomputed hash. In development, a
 * miss with `_source` available requests a runtime translation and
 * invalidates the state once it arrives.
 */
export function lookupJsxTranslation(
  state: GTState,
  props: TranslationProps
): JsxChildren | undefined {
  // Read the revision so callers re-run after async cache updates.
  void state.revision;
  const { locale } = state;
  if (!requiresTranslation(locale)) return undefined;

  const options = {
    $format: 'JSX',
    $_hash: props._hash,
    ...(props.context && { $context: props.context }),
    ...(props.id && { $id: props.id }),
    ...(props.maxChars != null && { $maxChars: props.maxChars }),
    ...(props.requiresReview === true && { $requiresReview: true }),
  } as LookupOptions;
  const message = (props._source ?? null) as Translation;
  const cache = getI18nCache();
  const translation = cache.lookupTranslation(locale, message, options);

  if (translation == null && props._source != null && isDevHotReloadEnabled()) {
    requestTranslation(state, () =>
      cache.lookupTranslationWithFallback(locale, message, options)
    );
  }
  return (translation ?? undefined) as JsxChildren | undefined;
}

/**
 * Starts a runtime translation request, then invalidates the state once the
 * translation is in the cache. Failures keep rendering the source.
 */
export function requestTranslation(
  state: GTState,
  request: () => Promise<unknown>
): void {
  void request()
    .then((translation) => {
      if (translation != null) state.invalidate();
    })
    .catch(() => {});
}
