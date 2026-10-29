import type { DictionaryProviderProps } from '@generaltranslation/react-core/components';
import type { SharedGTProviderProps } from '../provider/GTProviderProps';

/**
 * Props of the `/compat` GTProvider: everything the root GTProvider takes,
 * plus the dictionaries useTranslations() reads.
 *
 * - dictionaries: dictionaries keyed by locale, such as a snapshot streamed
 *   from the server
 * - onMissingDictionaryEntry / onMissingDictionaryObj: override how dev hot
 *   reload handles missing dictionary entries in the browser. During server
 *   rendering, missing entries are always translated during render
 */
export type GTProviderProps = SharedGTProviderProps &
  Omit<DictionaryProviderProps, 'compatStore' | 'children'>;
