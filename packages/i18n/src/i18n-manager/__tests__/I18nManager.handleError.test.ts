import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nManager } from '../I18nManager';

// Mock createTranslateManyFactory so constructor doesn't need real GT
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => vi.fn()),
}));

describe('I18nManager.handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws in development mode when error occurs', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      environment: 'development',
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    await expect(manager.loadTranslations('fr')).rejects.toThrow('Load failed');
  });

  it('logs and returns fallback in production mode', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      environment: 'production',
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    // Should not throw, returns empty object
    const result = await manager.loadTranslations('fr');
    expect(result).toEqual({});
  });
});
