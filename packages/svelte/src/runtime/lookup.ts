import type { JsxChildren } from '@generaltranslation/format';
import { getI18nCache, getI18nConfig } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal';
import type { GTState } from './state.svelte';

/** Static `<T>` props forwarded to translation lookups. */
export type TranslationProps = {
  _hash: string;
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

/** Whether content in this locale is translated rather than shown as source. */
export function requiresTranslation(locale: string): boolean {
  return getI18nConfig().requiresTranslation({ locale });
}

/** Looks up a `<T>` translation by its precomputed hash. */
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
  const translation = getI18nCache().lookupTranslation(locale, null, options);
  return (translation ?? undefined) as JsxChildren | undefined;
}
