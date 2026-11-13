import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { hashContent } from '../../../utils/hashContent';
import {
  prefetchStringContentWithRuntimeFallback,
  resolveJsx,
  resolveJsxWithRuntimeFallback,
  resolveStringContentWithFallback,
  resolveStringContentWithRuntimeFallback,
} from '../helpers';

const icuHash = (message: string) => hashContent(message, { $format: 'ICU' });

function setupCache(preloadedTranslations: Record<string, string> = {}) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
  const cache = new I18nCache({
    loadTranslations: vi.fn().mockResolvedValue(preloadedTranslations),
  });
  setI18nCache(cache);
  return cache;
}

/** Flushes the runtime-translation batch timer, then hands back the lookup */
async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(50);
  return pending;
}

describe('translation helpers', () => {
  let translateMany: MockInstance<GTRuntime['translateMany']>;
  let warnSpy: MockInstance;

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useFakeTimers();
    translateMany = vi
      .spyOn(GTRuntime.prototype, 'translateMany')
      .mockResolvedValue({} as never);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolveJsx looks up JSX in the provided locale and returns undefined on a miss', () => {
    const lookupTranslation = vi.spyOn(setupCache(), 'lookupTranslation');

    expect(resolveJsx('fr', ['Hello'])).toBeUndefined();
    expect(lookupTranslation).toHaveBeenCalledWith(
      'fr',
      ['Hello'],
      expect.objectContaining({ $format: 'JSX', $locale: 'fr' })
    );
  });

  it('resolveStringContentWithFallback formats the source in the source locale when no translation is found', () => {
    const lookupTranslation = vi.spyOn(setupCache(), 'lookupTranslation');

    expect(
      resolveStringContentWithFallback('fr', 'Value {n, number}', {
        $format: 'ICU',
        n: 1234.5,
      })
    ).toBe('Value 1,234.5');
    // Strings default to the literal STRING format
    expect(resolveStringContentWithFallback('fr', 'Hello {name}!')).toBe(
      'Hello {name}!'
    );
    expect(lookupTranslation).toHaveBeenLastCalledWith(
      'fr',
      'Hello {name}!',
      expect.objectContaining({ $format: 'STRING', $locale: 'fr' })
    );
  });

  it('resolveStringContentWithRuntimeFallback interpolates a preloaded translation without runtime translating', async () => {
    setupCache({ [icuHash('Hello {name}!')]: 'Bonjour {name} !' });

    await expect(
      resolveStringContentWithRuntimeFallback('fr', 'Hello {name}!', {
        $format: 'ICU',
        name: 'Alice',
      })
    ).resolves.toBe('Bonjour Alice !');
    expect(translateMany).not.toHaveBeenCalled();
  });

  it('resolveStringContentWithRuntimeFallback runtime translates a message that was not preloaded', async () => {
    const message = 'Good morning';
    const hash = icuHash(message);
    setupCache();
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: 'Bonjour' },
    } as never);

    await expect(
      settle(
        resolveStringContentWithRuntimeFallback('fr', message, {
          $format: 'ICU',
        })
      )
    ).resolves.toBe('Bonjour');

    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(translateMany.mock.calls[0][0]).toMatchObject({
      [hash]: { source: message },
    });
  });

  it('resolveStringContentWithRuntimeFallback falls back to the source when runtime translation fails', async () => {
    const message = 'Fallback test';
    setupCache();
    translateMany.mockResolvedValue({
      [hashContent(message, { $format: 'STRING' })]: {
        success: false,
        error: 'Translation failed',
      },
    } as never);

    // The failed entry is logged and swallowed, so the helper returns the source
    await expect(
      settle(
        resolveStringContentWithRuntimeFallback('fr', message, {
          $format: 'STRING',
        })
      )
    ).resolves.toBe(message);
  });

  it('resolveJsxWithRuntimeFallback runtime translates missing JSX', async () => {
    const content = ['Hello ', 'world'];
    const translatedContent = ['Bonjour ', 'le monde'];
    setupCache();
    translateMany.mockResolvedValue({
      [hashContent(content, { $format: 'JSX' })]: {
        success: true,
        translation: translatedContent,
      },
    } as never);

    await expect(
      settle(resolveJsxWithRuntimeFallback('fr', content))
    ).resolves.toEqual(translatedContent);
    expect(translateMany).toHaveBeenCalledTimes(1);
  });

  it('prefetchStringContentWithRuntimeFallback does not interpolate placeholder messages', async () => {
    // Regression: compiler-injected prefetch calls (GtInternalRuntimeTranslateString)
    // carry no variable values. Interpolating the discarded result used to warn
    // "String interpolation failed" for every message with a placeholder.
    setupCache({ [icuHash('Hello {0}')]: 'Bonjour {0}' });

    await prefetchStringContentWithRuntimeFallback('fr', 'Hello {0}', {
      $format: 'ICU',
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(translateMany).not.toHaveBeenCalled();
  });

  it('prefetchStringContentWithRuntimeFallback still registers missing translations', async () => {
    const message = 'Trip for {0} guests';
    const hash = icuHash(message);
    setupCache();
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: 'Voyage pour {0} personnes' },
    } as never);

    await settle(
      prefetchStringContentWithRuntimeFallback('fr', message, {
        $format: 'ICU',
      })
    );

    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(translateMany.mock.calls[0][0]).toMatchObject({
      [hash]: { source: message },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
