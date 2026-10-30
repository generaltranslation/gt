// Declarations behind the exports map's "types" conditions of gt-next/compat.
// They describe the App Router usage, whichever runtime entry is picked.
import type { ReactNode } from 'react';
import { typesFileError } from './errors/createErrors';
import type { GTDictionaryProviderProps } from './compat/GTDictionaryProvider';

/**
 * Supplies dictionaries to `useTranslations()` in client components. A server
 * component: it loads the dictionaries for the current locale and streams
 * them to the client. Render it in an App Router layout, inside or around
 * `GTProvider`. The Pages Router is not supported.
 *
 * @example
 * <GTProvider>
 *   <GTDictionaryProvider>{children}</GTDictionaryProvider>
 * </GTProvider>
 */
export function GTDictionaryProvider(
  _props: GTDictionaryProviderProps
): ReactNode {
  throw new Error(typesFileError);
}

export type { GTDictionaryProviderProps };
export { useTranslations, type UseTranslationsFunction } from 'gt-react/compat';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryEntryOptions,
  DictionaryKey,
  DictionaryLeaf,
  DictionaryLoader,
  DictionaryObject,
  DictionaryObjectTranslation,
  DictionaryPath,
  DictionaryValue,
} from 'gt-i18n/internal/compat';
