import type { LocaleCandidates } from 'gt-i18n/internal/types';
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
  pushLocaleCandidates(candidates, nativeStoreGet(localeStoreKey));
  candidates.push(...getNativeLocales());

  return resolveLocale(candidates);
}

function pushLocaleCandidates(
  target: string[],
  locale: LocaleCandidates | null
) {
  if (!locale) return;
  if (Array.isArray(locale)) {
    target.push(...locale);
    return;
  }
  target.push(locale);
}
