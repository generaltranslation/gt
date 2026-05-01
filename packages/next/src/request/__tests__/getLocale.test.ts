import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRequestFunction,
  mockGetRootParam,
  mockRequestLocale,
  mockRegisteredLocale,
} = vi.hoisted(() => ({
  mockGetRequestFunction: vi.fn(),
  mockGetRootParam: vi.fn(),
  mockRequestLocale: vi.fn(),
  mockRegisteredLocale: vi.fn(),
}));

vi.mock('@generaltranslation/next-internal', () => ({
  getRootParam: mockGetRootParam,
}));

vi.mock('../../config-dir/getI18NConfig', () => ({
  default: () => ({
    getDefaultLocale: () => 'en',
    getGTClass: () => ({
      isValidLocale: (locale: string) => locale !== 'invalid',
      resolveAliasLocale: (locale: string) => locale,
    }),
  }),
}));

vi.mock('../utils/getRequestFunction', () => ({
  getRequestFunction: mockGetRequestFunction,
}));

vi.mock('../utils/legacyGetLocaleFunction', () => ({
  legacyGetLocaleFunction: () => async () => 'legacy',
}));

vi.mock('../localeStore', () => ({
  localeStore: {
    getStore: mockRegisteredLocale,
  },
}));

vi.mock('../../utils/use', () => ({
  default: (value: unknown) => value,
}));

describe('getLocale', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env._GENERALTRANSLATION_ENABLE_SSG = 'false';
    mockGetRequestFunction.mockReturnValue(mockRequestLocale);
    mockRequestLocale.mockResolvedValue('en');
    mockRegisteredLocale.mockReturnValue(undefined);
  });

  it('prefers the locale root param over request locale resolution', async () => {
    mockGetRootParam.mockReturnValue('fr');

    const { getLocale } = await import('../getLocale');

    expect(await getLocale()).toBe('fr');
  });

  it('falls back to request locale resolution when the root param is invalid', async () => {
    mockGetRootParam.mockReturnValue('invalid');
    mockRequestLocale.mockResolvedValue('es');

    const { getLocale } = await import('../getLocale');

    expect(await getLocale()).toBe('es');
  });

  it('does not call request locale resolution in experimental mode after root param lookup', async () => {
    process.env._GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION = 'true';
    mockGetRootParam.mockReturnValue(undefined);
    mockRequestLocale.mockResolvedValue('es');

    const { getLocale } = await import('../getLocale');

    expect(await getLocale()).toBe('en');
    expect(mockGetRootParam).toHaveBeenCalledTimes(1);
    expect(mockGetRequestFunction).not.toHaveBeenCalled();
    expect(mockRequestLocale).not.toHaveBeenCalled();
  });

  it('keeps registered locales highest priority', async () => {
    mockRegisteredLocale.mockReturnValue('de');
    mockGetRootParam.mockReturnValue('fr');

    const { getLocale } = await import('../getLocale');

    expect(await getLocale()).toBe('de');
  });
});
