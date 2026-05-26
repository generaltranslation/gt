import { I18nManager } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nManagerParams } from '../i18n-cache/ReactI18nCache';
import { setRenderStrategy } from './globals';
import { setReactI18nManager } from '../i18n-cache/singleton-operations';

/**
 * Initialize GT for a server-side rendered application
 * - i18nManager
 *
 * ConditionStore and I18nStore are initialized in the provider at request time
 * TODO: auto detect if can find gt.config.json files
 */
export function internalInitializeGTSSR(config: ReactI18nManagerParams): void {
  setRenderStrategy('server-render');

  const i18nManager = new I18nManager<Translation>(config);
  setReactI18nManager(i18nManager);
}
