import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { hashMessage } from '../../../utils/hashMessage';
import { getGTInternal } from '../../internal/getGT';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const frInline = (translations: Record<string, string>) => (locale: string) =>
  translations[locale];

describe('inline translations', () => {
  let loadTranslations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    loadTranslations = vi.fn().mockResolvedValue({
      [hashMessage('Loaded', { $format: 'ICU' })]: 'Chargé',
    });
    setI18nCache(new I18nCache({ loadTranslations }));
  });

  afterEach(() => {
    resetGTGlobals();
  });

  describe('gt()', () => {
    it('uses the inline translation for the locale', async () => {
      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      expect(gt('Hello', {}, frInline({ fr: 'Bonjour' }))).toBe('Bonjour');
    });

    it('falls back to loaded translations when the locale is not inlined', async () => {
      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      expect(gt('Loaded', {}, frInline({ es: 'Cargado' }))).toBe('Chargé');
    });

    it('interpolates variables into inline translations', async () => {
      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      expect(
        gt(
          'Hello, {name}!',
          { name: 'Alice' },
          frInline({ fr: 'Salut, {name} !' })
        )
      ).toBe('Salut, Alice !');
    });

    it('ignores inline translations for the default locale', async () => {
      const gt = await getGTInternal({ locale: 'en', enableI18n: true });
      const inline = vi.fn(() => 'Bonjour');
      expect(gt('Hello', {}, inline)).toBe('Hello');
      expect(inline).not.toHaveBeenCalled();
    });

    it('passes the target locale to the callback', async () => {
      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      const inline = vi.fn(() => 'Bonjour');
      gt('Hello', { $locale: 'es' }, inline);
      expect(inline).toHaveBeenCalledWith('es');
    });
  });
});
