import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTranslations } from '../loadTranslations';

const loadTranslationsMock = vi.hoisted(() => vi.fn());
const i18nCacheMock = vi.hoisted(() => ({
  loadTranslations: loadTranslationsMock,
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReactI18nCache: () => i18nCacheMock,
}));

describe('loadTranslations', () => {
  beforeEach(() => {
    loadTranslationsMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches pending translation promises', () => {
    const promise = Promise.resolve({});
    loadTranslationsMock.mockReturnValue(promise);

    expect(loadTranslations('fr')).toBe(loadTranslations('fr'));
    expect(loadTranslationsMock).toHaveBeenCalledTimes(1);
  });

  it('warns and returns an empty snapshot when translation loading fails', async () => {
    loadTranslationsMock
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({});

    await expect(loadTranslations('es')).resolves.toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to load translations for locale "es". Falling back to an empty translation snapshot.',
      expect.any(Error)
    );
    await expect(loadTranslations('es')).resolves.toEqual({});
    expect(loadTranslationsMock).toHaveBeenCalledTimes(2);
  });
});
