import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { parseEnableI18n } from '../parseEnableI18n';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createContext(cookies = {}): GetServerSidePropsContext {
  return {
    req: {
      cookies,
    },
  } as GetServerSidePropsContext;
}

describe('parseEnableI18n', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig();
  });

  it('defaults to true without a cookie', () => {
    expect(parseEnableI18n(createContext())).toBe(true);
  });

  it('reads the default enableI18n cookie', () => {
    expect(
      parseEnableI18n(
        createContext({
          'generaltranslation.enable-i18n': 'false',
        })
      )
    ).toBe(false);
  });

  it('uses the configured enableI18n cookie name', () => {
    resetGTGlobals();
    initializeI18nConfig({
      enableI18nCookieName: 'custom-enable-i18n',
    });

    expect(
      parseEnableI18n(
        createContext({
          'custom-enable-i18n': 'false',
          'generaltranslation.enable-i18n': 'true',
        })
      )
    ).toBe(false);
  });
});
