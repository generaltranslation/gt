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

  it('formats only the template text when translation is not required', () => {
    expect(t`hello, ${'{brian}'}`).toBe('hello, {brian}');
    // Same output as the translated path, which ICU-formats the template
    expect(t`Hello '{team}' ${'John'}`).toBe('Hello {team} John');
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
      '7ac4062cd2c62378': 'Fichier : report_gt_final',
      fa71f1836c559d3b: "Bonjour '{team}' John",
    };
    lookupTranslation.mockImplementation(
      (_locale: string, message: string, options: LookupOptions) =>
        cliTranslations[hashMessage(message, options)]
    );

    expect(t`Hello ${derive('John')}`).toBe('Bonjour John');
    expect(t`Don't stop, ${derive('John')}`).toBe("N'arrête pas, John");
    expect(t`File: ${derive('report_gt_final')}`).toBe(
      'Fichier : report_gt_final'
    );
    expect(t`Hello '{team}' ${derive('John')}`).toBe('Bonjour {team} John');
  });

  describe('falls back to the placeholder lookup for ICU-looking runtime values', () => {
    beforeEach(() => {
      resetGTGlobals();
      setup('fr');
      const translations: Record<string, string> = {
        [hashMessage('Hello {0}', { $format: 'ICU' })]: "L''ami {0}",
        [hashMessage('File: {0}', { $format: 'ICU' })]: 'Fichier : {0}',
        [hashMessage('Tag: {0}', { $format: 'ICU' })]: 'Balise : {0}',
      };
      lookupTranslation.mockImplementation(
        (_locale: string, message: string, options: LookupOptions) =>
          translations[hashMessage(message, options)]
      );
    });

    it('supplies placeholder variables for runtime ICU arguments', () => {
      expect(t`Hello ${'{0}'}`).toBe("L'ami {0}");
    });

    // hashMessage ICU-parses _gt_ text, so malformed runtime text would throw
    it('does not hash malformed runtime _gt_ text as ICU', () => {
      expect(t`File: ${'report_gt_{draft'}`).toBe('Fichier : report_gt_{draft');
      expect(t`Tag: ${'x_gt_ <b'}`).toBe('Balise : x_gt_ <b');
    });
  });
});
