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

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
  getTranslationsInternal: mockGetTranslationsInternal,
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
  });

  it('getGT passes request conditions to gt-i18n', async () => {
    const gt = vi.fn();
    mockGetGTInternal.mockReturnValue(gt);
    const { getGT } = await import('../strings');

    await expect(getGT()).resolves.toBe(gt);

    expect(mockGetGTInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
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
});
