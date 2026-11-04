import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { hashMessage } from '../../../utils/hashMessage';
import { getGTInternal } from '../../internal/getGT';
import { getMessagesInternal } from '../../internal/getMessages';
import { msg } from '../../msg/msg';
import { clearRegisteredInlineTranslations } from '../inlineTranslations';

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
    clearRegisteredInlineTranslations();
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
    clearRegisteredInlineTranslations();
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

    it('passes the resolved translation locale to the callback', async () => {
      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      const inline = vi.fn(() => 'Bonjour');
      gt('Hello', { $locale: 'es' }, inline);
      expect(inline).toHaveBeenCalledWith('es');
    });
  });

  describe('msg() + m()', () => {
    it('resolves inline translations registered by msg()', async () => {
      const encoded = msg('Hello', undefined, frInline({ fr: 'Bonjour' }));
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m(encoded)).toBe('Bonjour');
    });

    it('resolves inline translations for msg() with options', async () => {
      const encoded = msg(
        'Hello, {name}!',
        { name: 'Alice', $context: 'greeting' },
        frInline({ fr: 'Salut, {name} !' })
      );
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m(encoded)).toBe('Salut, Alice !');
    });

    it('resolves STRING inline translations', async () => {
      const encoded = msg(
        'Hello {name}',
        { $format: 'STRING' },
        frInline({ fr: 'Bonjour {name}' })
      );
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m(encoded)).toBe('Bonjour {name}');
    });

    it('resolves inline translations for each msg() array element', async () => {
      const encoded = msg(['Hello', 'Loaded'], undefined, (locale) =>
        locale === 'fr' ? ['Bonjour', undefined] : undefined
      );
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(encoded.map((entry) => m(entry))).toEqual(['Bonjour', 'Chargé']);
    });

    it('resolves inline translations for msg() arrays with options', async () => {
      const encoded = msg(
        ['Hi {name}', 'Bye {name}'],
        { name: 'Alice', $id: 'greetings' },
        (locale) =>
          locale === 'fr' ? ['Salut {name}', 'Au revoir {name}'] : undefined
      );
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(encoded.map((entry) => m(entry))).toEqual([
        'Salut Alice',
        'Au revoir Alice',
      ]);
    });

    it('resolves STRING inline translations for msg() arrays', async () => {
      const encoded = msg(['A {x}', 'B'], { $format: 'STRING' }, (locale) =>
        locale === 'fr' ? ['Un {x}', 'Deux'] : undefined
      );
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(encoded.map((entry) => m(entry))).toEqual(['Un {x}', 'Deux']);
    });

    it('falls back to loaded translations for locales msg() did not inline', async () => {
      msg('Loaded', undefined, frInline({ es: 'Cargado' }));
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m('Loaded')).toBe('Chargé');
    });
  });

  describe('I18nCache.lookupTranslationWithFallback()', () => {
    it('does not load the locale when the translation is inlined', async () => {
      const cache = new I18nCache({ loadTranslations });
      const translation = await cache.lookupTranslationWithFallback(
        'fr',
        'Hello',
        { $format: 'ICU' },
        frInline({ fr: 'Bonjour' })
      );
      expect(translation).toBe('Bonjour');
      expect(loadTranslations).not.toHaveBeenCalled();
    });
  });
});
