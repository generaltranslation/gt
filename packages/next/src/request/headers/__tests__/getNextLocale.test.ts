import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cookies, headers } from 'next/headers';
import { getI18NConfig } from '../../../config-dir/getI18NConfig';

const mockNextHeaders = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

const mockConfig = vi.hoisted(() => ({
  getI18NConfig: vi.fn(),
}));

vi.mock('next/headers', () => mockNextHeaders);

vi.mock('../../../config-dir/getI18NConfig', () => mockConfig);

const determineLocale = vi.fn();

function mockHeaders(values: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

function mockCookies(values: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string) => {
      const value = values[key];
      return value ? { value } : undefined;
    }),
  };
}

describe('getNextLocale', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'false';
    vi.resetModules();
    vi.clearAllMocks();
    determineLocale.mockReturnValue('en');
    vi.mocked(getI18NConfig).mockReturnValue({
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'fr'],
      getLocaleHeaderName: () => 'x-generaltranslation-locale',
      getLocaleCookieName: () => 'generaltranslation.locale',
      getGTClass: () => ({
        determineLocale,
      }),
    } as any);
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('does not warn when locale resolution succeeds with the default locale', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(headers).mockResolvedValue(mockHeaders() as any);
    vi.mocked(cookies).mockResolvedValue(mockCookies() as any);

    const { getNextLocale } = await import('../getNextLocale');

    await expect(getNextLocale()).resolves.toBe('en');

    expect(determineLocale).toHaveBeenCalledWith(['en'], ['en', 'fr']);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns at most once for the same unresolved headers object', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const headersList = mockHeaders();
    vi.mocked(headers).mockResolvedValue(headersList as any);
    vi.mocked(cookies).mockResolvedValue(mockCookies() as any);
    determineLocale.mockReturnValue(undefined);

    const { getNextLocale } = await import('../getNextLocale');

    await getNextLocale();
    await getNextLocale();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
