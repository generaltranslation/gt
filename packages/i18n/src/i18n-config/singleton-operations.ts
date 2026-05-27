import { I18nConfig, type I18nConfigParams } from './I18nConfig';

let i18nConfig: I18nConfig | undefined = undefined;

export function getI18nConfig(): I18nConfig {
  if (!i18nConfig) {
    throw new Error(
      'getI18nConfig(): I18nConfig was not initialized. Call initializeGT() before reading locale config.'
    );
  }
  return i18nConfig;
}

export function setI18nConfig(nextI18nConfig: I18nConfig): void {
  i18nConfig = nextI18nConfig;
}

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}

export function isI18nConfigInitialized(): boolean {
  return i18nConfig !== undefined;
}
