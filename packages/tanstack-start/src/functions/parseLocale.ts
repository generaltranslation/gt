import { getCookie, getRequestHeader } from '@tanstack/react-start/server';
import { getI18nConfig } from 'gt-i18n/internal';
import { defaultLocaleCookieName } from 'gt-react';

/**
 * Resolve the user's locale from the current TanStack Start server request.
 */
export function parseLocale(): string {
  const candidates: string[] = [];

  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  const headers =
    getRequestHeader('accept-language')
      ?.split(',')
      .map((item) => item.split(';')?.[0].trim()) || [];
  candidates.push(...headers);

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(server): no locales could be determined for this request'
    );
  }

  const i18nConfig = getI18nConfig();
  return (
    i18nConfig
      .getGTClass()
      .determineLocale(candidates, i18nConfig.getLocales()) ||
    i18nConfig.getDefaultLocale()
  );
}
