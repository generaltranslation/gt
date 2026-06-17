import type { LocaleCandidates } from 'gt-i18n/internal/types';
import { getNativeLocales } from './getNativeLocales';
import { nativeStoreGet } from './nativeStore';
import { resolveLocale } from './resolveLocale';
import { defaultLocaleStoreKey } from './storeKeys';

export type GetLocaleParams = {
  localeStoreKey?: string;
};

/**
 * @internal
 */
export function getLocale({
  localeStoreKey = defaultLocaleStoreKey,
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
