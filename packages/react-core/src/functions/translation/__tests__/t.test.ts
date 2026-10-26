import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { t } from '../t';
import { hashMessage } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';
import { derive } from 'generaltranslation';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslation = vi.fn();

function setup(locale = 'en') {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    'SPA'
  );
  setReadonlyConditionStore({
    getLocale: () => locale,
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

  it('returns tagged template literals unformatted when translation is not required', () => {
    expect(t`hello, ${'{brian}'}`).toBe('hello, {brian}');
    expect(lookupTranslation).not.toHaveBeenCalled();
  });

  it('looks up tagged template literals in ICU format', () => {
    resetGTGlobals();
    setup('fr');
    t`hello, ${'brian'}`;

    expect(lookupTranslation).toHaveBeenCalledWith(
      'fr',
      'hello, brian',
      expect.objectContaining({ $format: 'ICU' })
    );
  });

  it('finds derive-only tagged templates by the CLI-registered hash', () => {
    resetGTGlobals();
    setup('fr');
    // Hashes the CLI registers for t`Hello ${derive(name)}` variants
    // (pinned in processTaggedTemplateCall.test.ts)
    const cliTranslations: Record<string, string> = {
      '9030b4f4c41221cc': 'Bonjour John',
      '4651b752888ee7cb': "N''arrête pas, John",
    };
    lookupTranslation.mockImplementation(
      (_locale: string, message: string, options: LookupOptions) =>
        cliTranslations[hashMessage(message, options)]
    );

    expect(t`Hello ${derive('John')}`).toBe('Bonjour John');
    expect(t`Don't stop, ${derive('John')}`).toBe("N'arrête pas, John");
  });
});
