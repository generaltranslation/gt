import { hashSource } from 'generaltranslation/id';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { t } from '../../unstable';
import { getGT } from '../gt';

const translateMany = vi.fn();
vi.mock(
  '../../i18n-cache/translations-manager/utils/createTranslateMany',
  () => ({ createTranslateManyFactory: () => () => translateMany })
);

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

describe('gt-i18n/unstable runtime translation', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'development');
    translateMany.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  it('sends a missing tree for runtime translation in dev hot reload, like other formats', async () => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      apiKey: 'dev-key',
      projectId: 'project-id',
    });
    const cache = new I18nCache({ loadTranslations: async () => ({}) });
    setI18nCache(cache);
    setWritableConditionStore({
      getLocale: () => 'fr',
      getEnableI18n: () => true,
    });
    await cache.loadTranslations('fr');

    const source = 'Save';
    const hash = hashSource({
      source,
      dataFormat: 'MESSAGE_TREE',
      context: 'button',
    });
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: 'Enregistrer' },
    });

    expect(t({ context: 'button' })`Save`).toBe('Save');
    await vi.advanceTimersByTimeAsync(50);

    expect(translateMany).toHaveBeenCalledWith({
      [hash]: {
        source,
        metadata: expect.objectContaining({
          hash,
          context: 'button',
          dataFormat: 'MESSAGE_TREE',
        }),
      },
    });
    expect(t({ context: 'button' })`Save`).toBe('Enregistrer');
  });

  it('translates a getGT() miss into the cache its GT reads, even once it expires', async () => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      apiKey: 'dev-key',
      projectId: 'project-id',
    });
    // Expires at once, so a reload would leave this GT's cache behind.
    setI18nCache(
      new I18nCache({ loadTranslations: async () => ({}), cacheExpiryTime: 0 })
    );
    const hash = hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' });
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: 'Enregistrer' },
    });

    const gt = await getGT({ locale: 'fr', enableI18n: true });
    expect(gt`Save`).toBe('Save');
    await vi.advanceTimersByTimeAsync(50);

    expect(gt`Save`).toBe('Enregistrer');
  });
});
