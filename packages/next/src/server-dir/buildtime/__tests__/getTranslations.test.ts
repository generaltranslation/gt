import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetGTInternal,
  mockGetI18nConfig,
  mockGetMessagesInternal,
  mockGetNextI18nCache,
  mockGetRequestConditions,
  mockGetTranslationsInternal,
  mockUse,
} = vi.hoisted(() => ({
  mockGetGTInternal: vi.fn(),
  mockGetI18nConfig: vi.fn(),
  mockGetMessagesInternal: vi.fn(),
  mockGetNextI18nCache: vi.fn(),
  mockGetRequestConditions: vi.fn(),
  mockGetTranslationsInternal: vi.fn(),
  mockUse: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getI18nConfig: mockGetI18nConfig,
  getMessagesInternal: mockGetMessagesInternal,
  getTranslationsInternal: mockGetTranslationsInternal,
}));

vi.mock('../../../i18n-cache/NextI18nCache', () => ({
  getNextI18nCache: mockGetNextI18nCache,
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../../utils/use', () => ({
  use: mockUse,
}));

describe('buildtime translation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
    mockGetI18nConfig.mockReturnValue({
      getDefaultLocale: () => 'en',
    });
    mockGetNextI18nCache.mockReturnValue({
      loadDictionaries: vi
        .fn()
        .mockResolvedValueOnce({ en: { greeting: 'Hello' } })
        .mockResolvedValueOnce({ fr: { greeting: 'Bonjour' } }),
      updateDictionaries: vi.fn(),
    });
  });

  it('getGT passes request conditions to gt-i18n', async () => {
    const gt = vi.fn();
    mockGetGTInternal.mockReturnValue(gt);
    const { getGT } = await import('../strings');

    await expect(getGT()).resolves.toBe(gt);

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      {
        locale: 'fr',
        enableI18n: false,
      },
      undefined
    );
  });

  it('getGT forwards compiler messages to gt-i18n', async () => {
    const gt = vi.fn();
    const messages = [{ message: 'A server-translated string from getGT.' }];
    mockGetGTInternal.mockReturnValue(gt);
    const { getGT } = await import('../strings');

    await expect(getGT(messages)).resolves.toBe(gt);

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      {
        locale: 'fr',
        enableI18n: false,
      },
      messages
    );
  });

  it('getMessages passes request conditions to gt-i18n', async () => {
    const messages = vi.fn();
    mockGetMessagesInternal.mockReturnValue(messages);
    const { getMessages } = await import('../strings');

    await expect(getMessages()).resolves.toBe(messages);

    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it('getTranslations passes request conditions to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../strings');

    await expect(getTranslations()).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: undefined,
    });
    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledTimes(1);
    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledWith('en');
    expect(mockGetNextI18nCache().updateDictionaries).toHaveBeenCalledWith({
      en: { greeting: 'Hello' },
    });
  });

  it('getTranslations forwards root id to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: true,
    });
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../strings');

    await expect(getTranslations('metadata')).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: true,
      rootId: 'metadata',
    });
    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledWith('en');
    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledWith('fr');
    expect(mockGetNextI18nCache().updateDictionaries).toHaveBeenCalledWith({
      en: { greeting: 'Hello' },
      fr: { greeting: 'Bonjour' },
    });
  });

  it('getTranslations loads one dictionary when request locale matches source locale', async () => {
    const translations = vi.fn();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'en',
      _enableI18n: true,
    });
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../strings');

    await expect(getTranslations()).resolves.toBe(translations);

    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledTimes(1);
    expect(mockGetNextI18nCache().loadDictionaries).toHaveBeenCalledWith('en');
    expect(mockGetNextI18nCache().updateDictionaries).toHaveBeenCalledWith({
      en: { greeting: 'Hello' },
    });
    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'en',
      enableI18n: true,
      rootId: undefined,
    });
  });

  it.each([
    ['useGT', 'getGT', mockGetGTInternal],
    ['useMessages', 'getMessages', mockGetMessagesInternal],
    ['useTranslations', 'getTranslations', mockGetTranslationsInternal],
  ] as const)(
    '%s returns the resolved promise through use()',
    async (_, __, mock) => {
      const value = vi.fn();
      mock.mockReturnValue(value);
      mockUse.mockReturnValue(value);
      const module = await import('../strings');

      const result = module[_]();

      expect(result).toBe(value);
      expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    }
  );

  it('useGT forwards compiler messages through getGT', async () => {
    const value = vi.fn();
    const messages = [{ message: 'A server-translated string from useGT.' }];
    mockGetGTInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useGT } = await import('../strings');

    const result = useGT(messages);

    expect(result).toBe(value);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    expect(mockGetGTInternal).not.toHaveBeenCalled();

    await expect(mockUse.mock.calls[0][0]).resolves.toBe(value);

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      {
        locale: 'fr',
        enableI18n: false,
      },
      messages
    );
  });

  it('useTranslations forwards root id through getTranslations', async () => {
    const value = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useTranslations } = await import('../strings');

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
