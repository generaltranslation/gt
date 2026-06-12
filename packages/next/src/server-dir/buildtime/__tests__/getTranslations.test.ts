import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetRequestConditions,
  mockGetTranslationsInternal,
  mockUse,
} = vi.hoisted(() => ({
  mockGetGTInternal: vi.fn(),
  mockGetMessagesInternal: vi.fn(),
  mockGetRequestConditions: vi.fn(),
  mockGetTranslationsInternal: vi.fn(),
  mockUse: vi.fn(),
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../../utils/use', () => ({
  use: mockUse,
}));

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
  getTranslationsInternal: mockGetTranslationsInternal,
}));

describe('buildtime string helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it('passes request conditions to getGTInternal', async () => {
    const gt = vi.fn();
    mockGetGTInternal.mockReturnValue(gt);

    const { getGT } = await import('../strings');

    await expect(getGT()).resolves.toBe(gt);
    expect(mockGetGTInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it('passes request conditions to getMessagesInternal', async () => {
    const messages = vi.fn();
    mockGetMessagesInternal.mockReturnValue(messages);

    const { getMessages } = await import('../strings');

    await expect(getMessages()).resolves.toBe(messages);
    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it('passes request conditions to getTranslationsInternal', async () => {
    const translations = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(translations);

    const { getTranslations } = await import('../strings');

    await expect(getTranslations()).resolves.toBe(translations);
    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it.each([
    ['useGT', 'getGTInternal', mockGetGTInternal],
    ['useMessages', 'getMessagesInternal', mockGetMessagesInternal],
    ['useTranslations', 'getTranslationsInternal', mockGetTranslationsInternal],
  ] as const)(
    'uses React use() for %s',
    async (hookName, _internalName, mockInternal) => {
      const hookResult = {};
      const internalResult = vi.fn();
      mockInternal.mockReturnValue(internalResult);
      mockUse.mockReturnValue(hookResult);

      const module = await import('../strings');
      const result = module[hookName]();

      expect(result).toBe(hookResult);
      expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
      await expect(mockUse.mock.calls[0][0]).resolves.toBe(internalResult);
    }
  );
});
