import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';

const i18nConfigSingleton = createGlobalSingleton<I18nConfig>({
  namespace: 'i18n',
  key: 'i18nConfig',
  source: 'gt-i18n',
  notInitialized: () =>
    createDiagnosticMessage({
      source: 'gt-i18n',
      severity: 'Error',
      whatHappened: 'Cannot read I18nConfig before it has been initialized',
      why: 'the internal I18nConfig singleton is unavailable',
      fix: 'Call initializeGT() before reading locale config.',
    }),
});

export const getI18nConfig = i18nConfigSingleton.get;
export const setI18nConfig = i18nConfigSingleton.set;
export const isI18nConfigInitialized = i18nConfigSingleton.isInitialized;

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}
