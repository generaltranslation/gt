import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { determineLocaleClient } from '../determineLocaleClient';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    tanstackStart?: Record<string, unknown>;
  };
};

function resetI18nConfigSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

const localeConfig = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'brand-french'],
  customMapping: {
    'brand-french': {
      code: 'fr',
      name: 'Brand French',
    },
  },
};

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'document'
);

function restoreGlobalProperty(
  property: 'document',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe.sequential('determineLocaleClient', () => {
  beforeEach(() => {
    resetI18nConfigSingleton();
    initializeI18nConfig(localeConfig);
  });

  afterEach(() => {
    restoreGlobalProperty('document', originalDocumentDescriptor);
  });

  it('resolves the default locale cookie during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=brand-french',
      },
    });

    expect(determineLocaleClient(localeConfig)).toBe('brand-french');
  });

  it('resolves a custom locale cookie during client initialization', () => {
    resetI18nConfigSingleton();
    initializeI18nConfig({
      ...localeConfig,
      localeCookieName: 'custom-locale',
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=es; custom-locale=fr',
      },
    });

    expect(determineLocaleClient(localeConfig)).toBe('brand-french');
  });

  it('falls back to the default locale during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: '' },
    });

    expect(determineLocaleClient(localeConfig)).toBe('en');
  });
});
