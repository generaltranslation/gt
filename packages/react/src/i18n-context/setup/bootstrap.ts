import { initializeGT } from './initializeGT';
import { getBrowserI18nManager } from '../browser-i18n-manager/singleton-operations';
import { InitializeGTParams } from './types';

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
  const i18nManager = getBrowserI18nManager();

  // Update the html tag
  i18nManager.updateHtmlTag();

  // Load translations
  await i18nManager.loadTranslations();
}
