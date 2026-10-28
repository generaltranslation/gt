import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnsureNextDictionaryManager,
  mockGetRequestConditions,
  mockGetTranslationsInternal,
  mockUse,
} = vi.hoisted(() => ({
  mockEnsureNextDictionaryManager: vi.fn(),
  mockGetRequestConditions: vi.fn(),
  mockGetTranslationsInternal: vi.fn(),
  mockUse: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getTranslationsInternal: mockGetTranslationsInternal,
}));

vi.mock('../dictionaries', () => ({
  ensureNextDictionaryManager: mockEnsureNextDictionaryManager,
}));

vi.mock('../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../utils/use', () => ({
  use: mockUse,
}));

describe('compat getTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it('initializes the dictionary manager before reading dictionaries', async () => {
    mockGetTranslationsInternal.mockReturnValue(vi.fn());
    const { getTranslations } = await import('../getTranslations');

    await getTranslations();

    expect(mockEnsureNextDictionaryManager).toHaveBeenCalled();
  });

  it('useTranslations returns the resolved promise through use()', async () => {
    const value = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useTranslations } = await import('../getTranslations');

    const result = useTranslations();

    expect(result).toBe(value);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
  });

  it('getTranslations passes request conditions to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../getTranslations');

    await expect(getTranslations()).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: undefined,
    });
  });

  it('getTranslations forwards root id to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: true,
    });
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../getTranslations');

    await expect(getTranslations('metadata')).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: true,
      rootId: 'metadata',
    });
  });

  it('getTranslations loads one dictionary when request locale matches source locale', async () => {
    const translations = vi.fn();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'en',
      _enableI18n: true,
    });
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../getTranslations');

    await expect(getTranslations()).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'en',
      enableI18n: true,
      rootId: undefined,
    });
  });

  it('useTranslations forwards root id through getTranslations', async () => {
    const value = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useTranslations } = await import('../getTranslations');

    const result = useTranslations('metadata');

    expect(result).toBe(value);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    expect(mockGetTranslationsInternal).not.toHaveBeenCalled();

    await expect(mockUse.mock.calls[0][0]).resolves.toBe(value);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: 'metadata',
    });
  });
});
