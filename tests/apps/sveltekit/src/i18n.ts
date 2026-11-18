import type { TranslationCatalog } from 'gt-svelte';
import gtConfig from '../gt.config.json';

export const defaultLocale = gtConfig.defaultLocale;
export const locales = gtConfig.locales;
export const localeCookieName = 'generaltranslation.locale';

const catalogs = import.meta.glob<{ default: TranslationCatalog }>(
  './_gt/*.json'
);

export async function loadTranslations(
  locale: string
): Promise<TranslationCatalog> {
  const load = catalogs[`./_gt/${locale}.json`];
  return load ? (await load()).default : {};
}

export function resolveLocale(requested: string | undefined): string {
  return requested && [defaultLocale, ...locales].includes(requested)
    ? requested
    : defaultLocale;
}
