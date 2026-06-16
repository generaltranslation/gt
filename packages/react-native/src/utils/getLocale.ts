import { getI18nConfig } from 'gt-i18n/internal';
import type { LocaleCandidates } from 'gt-i18n/internal/types';
import { defaultLocaleCookieName as defaultLocaleStoreKey } from '@generaltranslation/react-core/internal';
import { getNativeLocales } from './getNativeLocales';
import { nativeStoreGet } from './nativeStore';

export type GetLocaleParams = {
  localeStoreKey?: string;
};

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

export function resolveLocale(candidates?: LocaleCandidates | null): string {
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates ?? undefined) ||
    i18nConfig.getDefaultLocale()
  );
}
