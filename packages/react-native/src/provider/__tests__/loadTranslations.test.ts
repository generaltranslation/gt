import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTranslations } from '../loadTranslations';

const loadTranslationsMock = vi.hoisted(() => vi.fn());
const i18nCacheMock = vi.hoisted(() => ({
  loadTranslations: loadTranslationsMock,
}));

vi.mock('@generaltranslation/react-core/context', () => ({
  getReactI18nCache: () => i18nCacheMock,
}));

describe('loadTranslations', () => {
  beforeEach(() => {
    loadTranslationsMock.mockReset();
  });

  it('caches pending translation promises', () => {
    const promise = Promise.resolve({});
    loadTranslationsMock.mockReturnValue(promise);

    expect(loadTranslations('fr')).toBe(loadTranslations('fr'));
    expect(loadTranslationsMock).toHaveBeenCalledTimes(1);
  });

  it('evicts rejected translation promises so callers can retry', async () => {
    loadTranslationsMock
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({});

    await expect(loadTranslations('es')).rejects.toThrow('failed');
    await expect(loadTranslations('es')).resolves.toEqual({});
    expect(loadTranslationsMock).toHaveBeenCalledTimes(2);
  });
});
