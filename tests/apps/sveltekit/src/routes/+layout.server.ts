import { loadTranslations, localeCookieName, resolveLocale } from '../i18n';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const locale = resolveLocale(cookies.get(localeCookieName));
  return { locale, translations: await loadTranslations(locale) };
};
