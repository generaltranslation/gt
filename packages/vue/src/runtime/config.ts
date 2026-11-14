import {
  I18nCache,
  getI18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import { addRuntimeCredentials } from 'gt-i18n/internal/credentials';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { Content } from '@generaltranslation/format';
import type { InitializeGTOptions } from '../types';

/**
 * Sets up the translation config and cache that every gt-vue plugin shares.
 * Call it once, from a module that both the server and the browser import,
 * before creating plugins with {@link createGT}. Later calls keep the first
 * config and cache.
 *
 * Translations are shared across server requests; each request keeps its
 * own locale in its {@link createGT} plugin.
 *
 * @param config - The `gt.config.json` values, the translation loader and
 * cache settings.
 *
 * @example
 * ```ts
 * import { initializeGT } from 'gt-vue';
 * import gtConfig from '../gt.config.json';
 *
 * initializeGT({
 *   ...gtConfig,
 *   loadTranslations: async (locale) =>
 *     (await import(`./_gt/${locale}.json`)).default,
 * });
 * ```
 */
export function initializeGT(config: InitializeGTOptions = {}): void {
  const runtimeConfig = addRuntimeCredentials(config, 'gt-vue');
  initializeI18nConfig(runtimeConfig);
  setI18nCache(
    new I18nCache<Content>({
      ...runtimeConfig,
      // Browser pages keep their translations until they reload; servers
      // keep the default expiry so long-running processes pick up updates.
      cacheExpiryTime:
        runtimeConfig.cacheExpiryTime === undefined &&
        typeof window !== 'undefined'
          ? null
          : runtimeConfig.cacheExpiryTime,
    })
  );
}

/** Throws a gt-vue diagnostic when {@link initializeGT} has not run. */
export function assertGTInitialized(): void {
  try {
    getI18nCache();
  } catch {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt-vue',
        severity: 'Error',
        whatHappened: 'gt-vue is not initialized',
        fix: 'Call initializeGT() before createGT(), or use initializeGTSPA() in a browser SPA',
      })
    );
  }
}
