import {
  DictionaryProvider,
  type DictionaryProviderProps,
} from '@generaltranslation/react-core/components';

/**
 * Props of GTDictionaryProvider, which supplies dictionaries to
 * useTranslations(). Render it inside or around GTProvider.
 *
 * - dictionaries: dictionaries keyed by locale
 * - onMissingDictionaryEntry / onMissingDictionaryObj: override how dev hot
 *   reload handles missing dictionary entries
 */
export type GTDictionaryProviderProps = Omit<
  DictionaryProviderProps,
  'compatStore'
>;

/** Supplies dictionaries to useTranslations(). Owns its dictionary store. */
export function GTDictionaryProvider(props: GTDictionaryProviderProps) {
  return <DictionaryProvider {...props} />;
}
