import { initializeGT } from 'gt-svelte';
import gtConfig from '../../gt.config.json';

/** Cookie the locale selector writes and the server reads. */
export const LOCALE_COOKIE = 'generaltranslation.locale';

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: [gtConfig.defaultLocale, ...gtConfig.locales],
  loadTranslations: async (locale) =>
    (await import(`../_gt/${locale}.json`)).default,
});
