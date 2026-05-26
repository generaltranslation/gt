import { initializeGT } from './initializeGT';
import { getBrowserI18nCache } from '../browser-i18n-cache/singleton-operations';
import type { InitializeGTParams } from './types';
import { getLocale } from '../functions/locale-operations';

/**
 * Initialization function for react-core library invoked to enable synchronous resolution
 * @param {InitializeGTParams} params - The parameters for the initialization
 * @returns {Promise<void>} A promise that resolves when the bootstrap is complete
 *
 * @example
 * import gtConfig from '../gt.config.json';
 *
 * async function loadTranslations(locale: string) {
 *   return (await import(`./_gt/${locale}.json`)).default;
 * }
 *
 * await bootstrap({
 *   ...gtConfig,
 *   loadTranslations,
 * });
 *
 * await import('./main.tsx')
 */
export async function bootstrap(params: InitializeGTParams): Promise<void> {
  initializeGT(params);
  const i18nCache = getBrowserI18nCache();
  const locale = getLocale();

  // Update the html tag
  i18nCache.updateHtmlTag(locale);

  // Load translations
  await i18nCache.loadTranslations(locale);
}
