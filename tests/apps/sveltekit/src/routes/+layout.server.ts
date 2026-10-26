import { LOCALE_COOKIE } from '$lib/gt';
import { loadTranslations } from 'gt-svelte';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, request }) => {
  const acceptLanguage = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);
  const cookieLocale = cookies.get(LOCALE_COOKIE);
  return {
    gt: await loadTranslations(
      cookieLocale ? [cookieLocale, ...acceptLanguage] : acceptLanguage
    ),
  };
};
