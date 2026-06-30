import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockHeaders } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockHeaders: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
  headers: mockHeaders,
}));

type GlobalWithGT = typeof globalThis & {
  __generaltranslation?: Record<string, Record<string, unknown> | undefined>;
};

let savedEnv: NodeJS.ProcessEnv;
let savedGeneralTranslation: GlobalWithGT['__generaltranslation'];
let savedFetch: typeof globalThis.fetch;

function setConfigEnv() {
  process.env.GT_PROJECT_ID = 'project-id';
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS =
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
    });
  process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
    cacheUrl: 'https://cache.example.com',
    headersAndCookies: {
      localeHeaderName: 'x-generaltranslation-locale',
      localeCookieName: 'generaltranslation.locale',
    },
    ignoreBrowserLocales: false,
  });
}

function resetGTGlobals() {
  delete (globalThis as GlobalWithGT).__generaltranslation;
  vi.resetModules();
}

describe('gt-next/server standalone entrypoint', () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
    savedGeneralTranslation = (globalThis as GlobalWithGT).__generaltranslation;
    savedFetch = globalThis.fetch;
    process.env = {};
    setConfigEnv();
    resetGTGlobals();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}),
    }) as unknown as typeof globalThis.fetch;
    mockHeaders.mockResolvedValue({
      get: (name: string) =>
        name === 'x-generaltranslation-locale' ? 'fr' : null,
    });
    mockCookies.mockResolvedValue({
      get: () => undefined,
    });
  });

  afterEach(() => {
    process.env = savedEnv;
    (globalThis as GlobalWithGT).__generaltranslation = savedGeneralTranslation;
    globalThis.fetch = savedFetch;
    vi.resetModules();
  });

  it('initializes global singletons before request helpers run', async () => {
    const { getLocale, getLocaleDirection, getRegion } =
      await import('../server');

    await expect(getLocale()).resolves.toBe('fr');
    await expect(getRegion()).resolves.toBeUndefined();
    expect(getLocaleDirection('ar')).toBe('rtl');
  });

  it('initializes global singletons before registerLocale runs', async () => {
    const { getLocale, registerLocale } = await import('../server');

    registerLocale('ar');

    await expect(getLocale()).resolves.toBe('ar');
  });

  it('initializes global singletons before translation helpers run', async () => {
    const { getGT } = await import('../server');

    const gt = await getGT();

    expect(gt('Hello')).toBe('Hello');
  });
});
