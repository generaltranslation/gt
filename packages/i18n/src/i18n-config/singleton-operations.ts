import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';
import {
  setupGTServicesEnabled,
  type GTServicesEnabledParams,
} from '../i18n-cache/utils/getGTServicesEnabled';

let i18nConfig: I18nConfig | undefined = undefined;

export function getI18nConfig(): I18nConfig {
  if (!i18nConfig) {
    throw new Error(getI18nConfigNotInitializedError());
  }
  return i18nConfig;
}

export function setI18nConfig(nextI18nConfig: I18nConfig): void {
  i18nConfig = nextI18nConfig;
}

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  setupGTServicesEnabled(params as GTServicesEnabledParams);
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}

export function isI18nConfigInitialized(): boolean {
  return i18nConfig !== undefined;
}

function getI18nConfigNotInitializedError(): string {
  return createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'Cannot read I18nConfig before it has been initialized',
    why: 'the internal I18nConfig singleton is unavailable',
    fix: 'Call initializeGT() before reading locale config.',
  });
}
