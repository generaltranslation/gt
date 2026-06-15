import { getCookie, getRequestHeader } from '@tanstack/react-start/server';
import { getI18nConfig } from 'gt-i18n/internal';
import { defaultLocaleCookieName } from 'gt-react/context';

/**
 * Resolve the user's locale from the current TanStack Start server request.
 */
export function parseLocale(): string {
  const candidates: string[] = [];

  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  const ignorePreferredLanguages =
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'true';

  if (!ignorePreferredLanguages) {
    const headers =
      getRequestHeader('accept-language')
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim()) || [];
    candidates.push(...headers);
  }

  if (candidates.length === 0 && !ignorePreferredLanguages) {
    console.warn(
      'gt-tanstack-start(server): no locales could be determined for this request'
    );
  }

  return getI18nConfig().resolveSupportedLocale(candidates);
}
