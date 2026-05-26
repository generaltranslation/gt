import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nCache } from '../I18nCache';

// Mock createTranslateManyFactory so constructor doesn't need real GT
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => vi.fn()),
}));

describe('I18nCache.handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws in development mode when error occurs', async () => {
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      environment: 'development',
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    await expect(cache.loadTranslations('fr')).rejects.toThrow('Load failed');
  });

  it('logs and returns fallback in production mode', async () => {
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      environment: 'production',
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    // Should not throw, returns empty object
    const result = await cache.loadTranslations('fr');
    expect(result).toEqual({});
  });
});
