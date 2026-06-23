import { getI18nConfig } from 'gt-i18n/internal';
import { determineLocale } from './determineLocale';

/**
 * Resolves the current request/browser locale from the active gt config.
 */
export function parseLocale(): string {
  const config = getI18nConfig();
  return determineLocale({
    defaultLocale: config.getDefaultLocale(),
    locales: config.getLocales(),
    customMapping: config.getCustomMapping(),
  });
}
