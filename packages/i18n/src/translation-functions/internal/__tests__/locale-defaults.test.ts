import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import type { I18nCacheConstructorParams } from '../../../i18n-cache/types';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { msg } from '../../msg/msg';
import { hashContent } from '../../../utils/hashContent';
import { getGT, getGTInternal } from '../getGT';
import { getMessages } from '../getMessages';
import { tx, txInternal } from '../tx';

const message = 'Hello {name}!';
const icuHash = (source: string, $context?: string) =>
  hashContent(source, { $format: 'ICU', ...($context && { $context }) });
const devHotReload = { apiKey: 'dev-key', projectId: 'project-id' };

/** Registers a cache for en → fr (plus config overrides) with fr as the current locale */
function setup(
  cacheConfig: I18nCacheConstructorParams = {},
  i18nConfig: I18nConfigParams = {}
) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    ...i18nConfig,
  });
  const cache = new I18nCache({
    loadTranslations: vi.fn().mockResolvedValue({}),
    ...cacheConfig,
  });
  setI18nCache(cache);
  setWritableConditionStore({
    getLocale: () => 'fr',
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
  return cache;
}

function setupTranslations(translations: Record<string, string>) {
  return setup({ loadTranslations: vi.fn().mockResolvedValue(translations) });
}

describe('translation function locale defaults', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    // Runtime translation must never reach the network.
    vi.spyOn(GTRuntime.prototype, 'translateMany').mockResolvedValue(
      {} as never
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('getGT', () => {
    it('uses the current locale without accepting a locale parameter', async () => {
      setupTranslations({ [icuHash(message)]: 'Bonjour {name} !' });

      const gt = await getGT();

      expect(gt(message, { name: 'Alice' })).toBe('Bonjour Alice !');
    });

    it('allows $locale to select another loaded locale', async () => {
      const cache = setup(
        {
          loadTranslations: vi.fn(async (locale: string) => ({
            [icuHash(message)]:
              locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
          })),
        },
        { locales: ['en', 'fr', 'es'] }
      );

      const gt = await getGT();
      await cache.loadTranslations('es');

      expect(gt(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
    });

    it('preloads compiler messages when dev hot reload is enabled', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = setup({}, devHotReload);
      const prefetchEntries = vi.fn();
      vi.spyOn(cache, 'getLookupTranslation').mockResolvedValue(
        Object.assign(vi.fn(), { prefetchEntries }) as Awaited<
          ReturnType<typeof cache.getLookupTranslation>
        >
      );

      await getGTInternal({ locale: 'fr', enableI18n: true }, [
        { message, $context: 'greeting' },
      ]);

      expect(prefetchEntries).toHaveBeenCalledWith([
        {
          content: message,
          options: { $context: 'greeting', $format: 'ICU' },
        },
      ]);
    });

    it('still returns a function when the dev hot reload preload rejects', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.useFakeTimers();
      const translateMany = vi
        .mocked(GTRuntime.prototype.translateMany)
        .mockRejectedValue(new Error('offline'));
      const cache = setup({}, devHotReload);

      const pending = getGTInternal({ locale: 'fr', enableI18n: true }, [
        { message },
      ]);
      // Flush the runtime-translation batch that the preload waits on
      await vi.advanceTimersByTimeAsync(50);
      const gt = await pending;

      expect(translateMany).toHaveBeenCalledTimes(1);
      // The fire-and-forget lookup of a still-missing message rejects too; an
      // unhandled rejection would fail this test.
      vi.spyOn(cache, 'lookupTranslationWithFallback').mockRejectedValue(
        new Error('offline')
      );
      expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('catches fire-and-forget dev hot reload lookup rejections', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = setup({}, devHotReload);
      const catchHandler = vi.fn();
      vi.spyOn(cache, 'lookupTranslationWithFallback').mockReturnValue({
        catch: catchHandler,
      } as unknown as ReturnType<typeof cache.lookupTranslationWithFallback>);

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

      expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
      expect(catchHandler).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('getMessages uses the current locale without accepting a locale parameter', async () => {
    setupTranslations({ [icuHash(message)]: 'Bonjour {name} !' });

    const m = await getMessages();

    expect(m(msg(message, { name: 'Alice' }))).toBe('Bonjour Alice !');
  });

  describe('tx', () => {
    const translations = {
      [hashContent('Hello', { $format: 'STRING' })]: 'Bonjour',
    };

    it('uses the current locale when $locale is omitted', async () => {
      setupTranslations(translations);

      await expect(tx('Hello')).resolves.toBe('Bonjour');
    });

    it('txInternal uses explicit $locale over the provided locale', async () => {
      setupTranslations(translations);

      await expect(
        txInternal({
          locale: 'en',
          enableI18n: true,
          content: 'Hello',
          options: { $locale: 'fr' },
        })
      ).resolves.toBe('Bonjour');
    });
  });
});
