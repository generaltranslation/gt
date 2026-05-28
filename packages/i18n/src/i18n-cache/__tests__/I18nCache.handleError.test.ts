import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';

// Mock createTranslateManyFactory so constructor doesn't need real GT
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => vi.fn()),
}));

describe('I18nCache.handleError', () => {
  beforeEach(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in development mode when error occurs', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const cache = new I18nCache({
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    await expect(cache.loadTranslations('fr')).rejects.toThrow('Load failed');
  });

  it('logs and returns fallback in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const cache = new I18nCache({
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    // Should not throw, returns empty object
    const result = await cache.loadTranslations('fr');
    expect(result).toEqual({});
  });
});
