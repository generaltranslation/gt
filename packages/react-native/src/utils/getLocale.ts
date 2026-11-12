import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getNativeLocales } from './getNativeLocales';
import { nativeStoreGet } from './nativeStore';
import { resolveLocale } from './resolveLocale';

export type GetLocaleParams = {
  localeStoreKey?: string;
};

/**
 * @internal
 */
export function getLocale({
  localeStoreKey = getI18nConfig().getLocaleCookieName(),
}: GetLocaleParams = {}): string {
  const candidates: string[] = [];
  const storedLocale = nativeStoreGet(localeStoreKey);
  if (storedLocale) candidates.push(storedLocale);
  candidates.push(...getNativeLocales());

  return resolveLocale(candidates);
}
