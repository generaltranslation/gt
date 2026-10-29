import type { DictionaryProviderProps } from '@generaltranslation/react-core/components';

/**
 * Props of GTDictionaryProvider, which supplies dictionaries to
 * useTranslations(). Render it inside or around GTProvider.
 *
 * - dictionaries: dictionaries keyed by locale, such as a snapshot streamed
 *   from the server
 * - onMissingDictionaryEntry / onMissingDictionaryObj: override how dev hot
 *   reload handles missing dictionary entries in the browser. During server
 *   rendering, missing entries are always translated during render
 */
export type GTDictionaryProviderProps = Omit<
  DictionaryProviderProps,
  'compatStore'
>;
