import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';
import { warnAboutLocalesWithoutIntlData } from './validation';

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
      fix: 'Initialize GT before reading locale config (call initializeGT() from your GT framework package).',
    }),
});

export const getI18nConfig = i18nConfigSingleton.get;
export const isI18nConfigInitialized = i18nConfigSingleton.isInitialized;

/**
 * Every framework sets its config through here, its own subclass of
 * I18nConfig included, so this is where a configuration is checked once.
 */
export function setI18nConfig(nextI18nConfig: I18nConfig): void {
  i18nConfigSingleton.set(nextI18nConfig);
  if (getRuntimeEnvironment() === 'development') {
    warnAboutLocalesWithoutIntlData(nextI18nConfig);
  }
}

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}
