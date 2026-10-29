import type { Cookies } from '@sveltejs/kit';
import { LOCALE_COOKIE } from '#lib/gt.ts';

/** The locales a request prefers: its cookie, then `Accept-Language`. */
export function getRequestLocales(
  cookies: Cookies,
  request: Request
): string[] {
  const acceptLanguage = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);
  const cookieLocale = cookies.get(LOCALE_COOKIE);
  return cookieLocale ? [cookieLocale, ...acceptLanguage] : acceptLanguage;
}
