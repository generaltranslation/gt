import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { t } from '../t';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslation = vi.fn();

function setup() {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    'SPA'
  );
  setReadonlyConditionStore({
    getLocale: () => 'en',
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
  setReactI18nCache({
    lookupTranslation,
  } as unknown as ReactI18nCache);
}

describe('t', () => {
  beforeEach(() => {
    resetGTGlobals();
    lookupTranslation.mockReset();
    setup();
  });

  it('interpolates source strings when translation is not required', () => {
    expect(t('hello, {name}', { name: 'brian' })).toBe('hello, brian');
  });

  it('keeps tagged template literal lookup in string format', () => {
    t`hello, ${'brian'}`;

    expect(lookupTranslation).toHaveBeenCalledWith('en', 'hello, brian', {
      $format: 'STRING',
    });
  });
});
