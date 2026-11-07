import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { hashMessage } from '../../../utils/hashMessage';
import { getGTInternal } from '../../internal/getGT';
import { getMessagesInternal } from '../../internal/getMessages';
import { msg } from '../../msg/msg';

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

  describe('msg() + m()', () => {
    beforeEach(() => {
      resetGTGlobals();
      initializeI18nConfig({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es'],
      });
      setI18nCache(new I18nCache({ loadTranslations, inlinedLocales: ['fr'] }));
    });

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
      // Embedded locales never load, so the element left undefined renders
      // the source
      expect(encoded.map((entry) => m(entry))).toEqual(['Bonjour', 'Loaded']);
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

    it('ignores translations for locales that are not embedded', async () => {
      msg('Loaded', undefined, frInline({ es: 'Cargado' }));
      const m = await getMessagesInternal({ locale: 'es', enableI18n: true });
      expect(m('Loaded')).toBe('Chargé');
    });
  });

  describe('inlinedLocales', () => {
    it('skips loadTranslations for inlined locales', async () => {
      const cache = new I18nCache({ loadTranslations, inlinedLocales: ['fr'] });
      expect(await cache.loadTranslations('fr')).toEqual({});
      await cache.lookupTranslationWithFallback('fr', 'Hello', {
        $format: 'ICU',
      });
      expect(loadTranslations).not.toHaveBeenCalled();
    });

    it('loads translations for other locales', async () => {
      const cache = new I18nCache({ loadTranslations, inlinedLocales: ['fr'] });
      await cache.loadTranslations('es');
      expect(loadTranslations).toHaveBeenCalledWith('es');
    });

    it('keeps loading when an inlined locale resolves to another app locale', async () => {
      resetGTGlobals();
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr-FR'] });
      const cache = new I18nCache({ loadTranslations, inlinedLocales: ['fr'] });
      await cache.loadTranslations('fr-FR');
      expect(loadTranslations).toHaveBeenCalledWith('fr-FR');
    });

    it('never expires msg() registrations for inlined locales', async () => {
      resetGTGlobals();
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
      setI18nCache(
        new I18nCache({
          loadTranslations,
          inlinedLocales: ['fr'],
          cacheExpiryTime: 1,
        })
      );
      const encoded = msg('Hello', undefined, frInline({ fr: 'Bonjour' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m(encoded)).toBe('Bonjour');
      expect(loadTranslations).not.toHaveBeenCalled();
    });

    it('sends msg() registrations to the client in the translations snapshot', async () => {
      resetGTGlobals();
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
      const serverCache = new I18nCache({
        loadTranslations,
        inlinedLocales: ['fr'],
      });
      setI18nCache(serverCache);
      const encoded = msg('Hello', undefined, frInline({ fr: 'Bonjour' }));
      const snapshot = await serverCache.loadTranslations('fr');
      expect(snapshot).toEqual({
        [hashMessage('Hello', { $format: 'ICU' })]: 'Bonjour',
      });

      // A client that never evaluated the msg() module resolves it from the
      // snapshot alone
      resetGTGlobals();
      initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
      const clientCache = new I18nCache({
        loadTranslations: vi.fn(),
        inlinedLocales: ['fr'],
      });
      setI18nCache(clientCache);
      clientCache.updateTranslations({ fr: snapshot });
      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
      expect(m(encoded)).toBe('Bonjour');
    });
  });
});

describe('msg() inline translations registry', () => {
  const newCache = () =>
    new I18nCache({ loadTranslations: vi.fn(), inlinedLocales: ['fr'] });

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
  });

  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('warns once and ignores inline translations before GT is initialized', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    msg('Hello', undefined, frInline({ fr: 'Bonjour' }));
    msg('Goodbye', undefined, frInline({ fr: 'Au revoir' }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('before GT was initialized');

    setI18nCache(newCache());
    const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
    expect(m('Hello')).toBe('Hello');
  });

  it('keeps registrations when GT is initialized again', async () => {
    setI18nCache(newCache());
    const encoded = msg('Hello', undefined, frInline({ fr: 'Bonjour' }));

    setI18nCache(newCache());
    const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });
    expect(m(encoded)).toBe('Bonjour');
  });

  it('is shared between separately evaluated copies of gt-i18n', async () => {
    // Bundlers such as Next.js evaluate gt-i18n once per server layer (RSC and
    // SSR), so msg() and m() can run against different module instances.
    setI18nCache(newCache());
    vi.resetModules();
    const rscCopy = await import('../../msg/msg');
    vi.resetModules();
    const ssrCopy = await import('../../internal/getMessages');

    const encoded = rscCopy.msg(
      'Hello',
      undefined,
      frInline({ fr: 'Bonjour' })
    );
    const m = await ssrCopy.getMessagesInternal({
      locale: 'fr',
      enableI18n: true,
    });
    expect(m(encoded)).toBe('Bonjour');
  });
});
