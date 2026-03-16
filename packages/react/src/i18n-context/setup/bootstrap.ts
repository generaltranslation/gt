import { initializeGT } from './initializeGT';
import { getBrowserI18nManager } from './singleton-operations';
import { InitializeGTParams } from './types';

/**
 * Initialization function for react-core library invoked to enable synchronous resolution
 * @param {InitializeGTParams} params - The parameters for the initialization
 * @returns {Promise<void>} A promise that resolves when the bootstrap is complete
 *
 * @example
 * import gtConfig from '../gt.config.json';
 *
 * function getTranslations(locale: string) {
 *   return import(`../public/_gt/${locale}.json`);
 * }
 *
 * await bootstrap({
 *   ...gtConfig,
 *   getTranslations,
 * });
 *
 * await import('./main.tsx')
 */
export async function bootstrap(params: InitializeGTParams): Promise<void> {
  initializeGT(params);
  const i18nManager = getBrowserI18nManager();
  await i18nManager.loadTranslations();
}
