import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';

type I18nGlobals = {
  i18nConfig?: I18nConfig;
  gtServicesEnabled?: boolean | undefined;
  [key: string]: unknown;
};

type GeneralTranslationGlobal = {
  i18n?: I18nGlobals;
  [key: string]: unknown;
};

type GlobalWithGeneralTranslation = {
  __generaltranslation?: GeneralTranslationGlobal;
};

function getI18nGlobals(): I18nGlobals {
  const globalObj = globalThis as unknown as GlobalWithGeneralTranslation;
  globalObj.__generaltranslation ??= {};
  // TODO: Consider checking package versions and using a compatibility matrix before sharing global singletons.
  globalObj.__generaltranslation.i18n ??= {};
  return globalObj.__generaltranslation.i18n;
}

export function getI18nConfig(): I18nConfig {
  const i18nConfig = getI18nGlobals().i18nConfig;
  if (!i18nConfig) {
    throw new Error(getI18nConfigNotInitializedError());
  }
  return i18nConfig;
}

export function setI18nConfig(nextI18nConfig: I18nConfig): void {
  const i18nGlobals = getI18nGlobals();
  if (i18nGlobals.i18nConfig && i18nGlobals.i18nConfig !== nextI18nConfig) {
    console.warn('gt-i18n: Overwriting global i18nConfig singleton instance.');
  }
  i18nGlobals.i18nConfig = nextI18nConfig;
}

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}

export function isI18nConfigInitialized(): boolean {
  return getI18nGlobals().i18nConfig !== undefined;
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
