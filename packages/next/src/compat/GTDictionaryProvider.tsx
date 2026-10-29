import type { ReactNode } from 'react';
import { getLocale } from '../request/getLocale';
import { Client_GTDictionaryProvider } from './client-boundary';
import { loadDictionaries } from './dictionaries';

export type GTDictionaryProviderProps = {
  children?: ReactNode;
};

/**
 * Supplies dictionaries to useTranslations() in client components. A server
 * component: it loads the dictionaries for the current locale and streams
 * them to the client, like GTProvider does with translations. Render it in an
 * App Router layout, inside or around GTProvider.
 */
export async function GTDictionaryProvider({
  children,
}: GTDictionaryProviderProps) {
  const dictionaries = await loadDictionaries(await getLocale());
  return (
    <Client_GTDictionaryProvider dictionaries={dictionaries}>
      {children}
    </Client_GTDictionaryProvider>
  );
}
