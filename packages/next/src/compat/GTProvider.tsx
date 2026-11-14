import { getGTProviderProps } from '../provider/GTProvider';
import { getLocale } from '../request/getLocale';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from './client-boundary';
import { loadDictionaries } from './dictionaries';

/**
 * GTProvider with dictionaries for useTranslations(). A server component: it
 * loads the translations and dictionaries for the current locale and streams
 * them to client components. Render it instead of GTProvider from 'gt-next'.
 */
export async function GTProvider({ children }: GTProviderProps) {
  const locale = await getLocale();
  const [props, dictionaries] = await Promise.all([
    getGTProviderProps(locale),
    loadDictionaries(locale),
  ]);
  return (
    <Client_GTProvider {...props} dictionaries={dictionaries}>
      {children}
    </Client_GTProvider>
  );
}
