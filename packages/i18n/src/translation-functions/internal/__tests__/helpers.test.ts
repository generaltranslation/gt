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
import { resolveJsxWithRuntimeFallback } from '../helpers';

function setupCache(preloadedTranslations: Record<string, string> = {}) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    // Runtime translation rejects without a project ID and an API key.
    projectId: 'test-project',
    apiKey: 'test-api-key',
  });
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

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useFakeTimers();
    translateMany = vi
      .spyOn(GTRuntime.prototype, 'translateMany')
      .mockResolvedValue({} as never);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.restoreAllMocks();
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
});
