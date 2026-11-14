import type { GetServerSidePropsContext, GetStaticPropsContext } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const mockGetTranslationsSnapshot = vi.hoisted(() => vi.fn());

vi.mock('gt-react', () => ({
  getTranslationsSnapshot: (...args: unknown[]) =>
    mockGetTranslationsSnapshot(...args),
}));

import { parseEnableI18n } from '../parseEnableI18n';
import { parseLocale, resolvePagesRouterLocale } from '../parseLocale';
import { withGTServerSideProps } from '../withGTServerSideProps';
import { withGTStaticProps } from '../withGTStaticProps';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

/** Resolves a per-locale translation snapshot, as gt-react would. */
function mockTranslationSnapshots() {
  mockGetTranslationsSnapshot.mockReset();
  mockGetTranslationsSnapshot.mockImplementation(async (locale: string) => ({
    [locale]: { hash: `${locale} translation` },
  }));
}

describe('parseEnableI18n', () => {
  function createContext(cookies = {}): GetServerSidePropsContext {
    return {
      req: {
        cookies,
      },
    } as GetServerSidePropsContext;
  }

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig();
  });

  it('defaults to true without a cookie', () => {
    expect(parseEnableI18n(createContext())).toBe(true);
  });

  it('reads the default enableI18n cookie', () => {
    expect(
      parseEnableI18n(
        createContext({
          'generaltranslation.enable-i18n': 'false',
        })
      )
    ).toBe(false);
  });

  it('uses the configured enableI18n cookie name', () => {
    resetGTGlobals();
    initializeI18nConfig({
      enableI18nCookieName: 'custom-enable-i18n',
    });

    expect(
      parseEnableI18n(
        createContext({
          'custom-enable-i18n': 'false',
          'generaltranslation.enable-i18n': 'true',
        })
      )
    ).toBe(false);
  });
});

describe('parseLocale', () => {
  const localeConfig = {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es', 'brand-french'],
    customMapping: {
      'brand-french': {
        code: 'fr',
        name: 'Brand French',
      },
    },
  };

  function createContext({
    locale,
    defaultLocale,
    headers = {},
    cookies = {},
  }: {
    locale?: string;
    defaultLocale?: string;
    headers?: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
  }): GetServerSidePropsContext {
    return {
      locale,
      defaultLocale,
      req: {
        headers,
        cookies,
      },
    } as GetServerSidePropsContext;
  }

  it('preserves the configured Next.js route locale spelling', () => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-gb'],
    });
    expect(parseLocale(createContext({ locale: 'en-gb' }))).toBe('en-gb');
    expect(resolvePagesRouterLocale({ locale: 'en-gb' })).toBe('en-gb');
  });
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig(localeConfig);
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('uses context.locale instead of headers, cookies, or Accept-Language', () => {
    const context = createContext({
      locale: 'fr',
      defaultLocale: 'en',
      headers: {
        'x-generaltranslation-locale': 'es',
        'accept-language': 'es',
      },
      cookies: {
        'generaltranslation.locale': 'es',
      },
    });

    expect(parseLocale(context)).toBe('fr');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('preserves a supported Next.js locale alias', () => {
    const context = createContext({
      locale: 'brand-french',
      defaultLocale: 'en',
    });

    expect(parseLocale(context)).toBe('brand-french');
  });

  it('uses defaultLocale instead of request headers when context.locale is missing', () => {
    const context = createContext({
      defaultLocale: 'es',
      headers: {
        'x-generaltranslation-locale': 'brand-french',
        'accept-language': 'fr',
      },
      cookies: {
        'generaltranslation.locale': 'fr',
      },
    });

    expect(parseLocale(context)).toBe('es');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('The locale "es" will be used')
    );
  });

  it('falls back to the GT default when Next.js provides no locale', () => {
    expect(parseLocale(createContext({}))).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('The locale "en" will be used')
    );
  });

  it('validates an unsupported context locale before returning it', () => {
    const context = createContext({
      locale: 'de',
      defaultLocale: 'en',
    });

    expect(parseLocale(context)).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "de" is not valid or is not supported')
    );
  });

  it('reports the resolved fallback when defaultLocale is unsupported', () => {
    expect(resolvePagesRouterLocale({ defaultLocale: 'de' })).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('The locale "en" will be used')
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('The locale "de" will be used')
    );
  });
});

describe('withGTServerSideProps', () => {
  const context = {
    locale: 'fr',
    defaultLocale: 'en',
    req: { cookies: {} },
  } as GetServerSidePropsContext;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    mockTranslationSnapshots();
  });

  it('adds locale and translations without a page handler', async () => {
    const getServerSideProps = withGTServerSideProps();

    await expect(getServerSideProps(context)).resolves.toEqual({
      props: {
        locale: 'fr',
        enableI18n: true,
        translations: { fr: { hash: 'fr translation' } },
      },
    });
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
  });

  it('merges locale and translations with page props', async () => {
    const getServerSideProps = withGTServerSideProps(
      async (_context: GetServerSidePropsContext) => ({
        props: {
          renderedAt: 'now',
        },
      })
    );

    await expect(getServerSideProps(context)).resolves.toEqual({
      props: {
        renderedAt: 'now',
        locale: 'fr',
        enableI18n: true,
        translations: { fr: { hash: 'fr translation' } },
      },
    });
  });

  it('adds enableI18n from the request cookie', async () => {
    const getServerSideProps = withGTServerSideProps();

    await expect(
      getServerSideProps({
        req: {
          cookies: {
            'generaltranslation.enable-i18n': 'false',
          },
        },
        locale: 'fr',
        defaultLocale: 'en',
      } as GetServerSidePropsContext)
    ).resolves.toEqual({
      props: {
        locale: 'fr',
        enableI18n: false,
        translations: { fr: { hash: 'fr translation' } },
      },
    });
  });

  it('ignores the legacy GT locale cookie in favor of context.locale', async () => {
    const getServerSideProps = withGTServerSideProps();

    await expect(
      getServerSideProps({
        ...context,
        req: {
          cookies: {
            'generaltranslation.locale': 'es',
          },
        },
      } as GetServerSidePropsContext)
    ).resolves.toMatchObject({
      props: {
        locale: 'fr',
      },
    });

    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
  });

  it('uses the default locale when context.locale is unavailable', async () => {
    const getServerSideProps = withGTServerSideProps();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      getServerSideProps({
        req: {
          headers: { 'accept-language': 'fr,en;q=0.8' },
          cookies: { 'generaltranslation.locale': 'es' },
        },
      } as GetServerSidePropsContext)
    ).resolves.toMatchObject({
      props: {
        locale: 'en',
        translations: { en: { hash: 'en translation' } },
      },
    });

    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('en');
    warn.mockRestore();
  });

  it('preserves redirects without loading translations', async () => {
    const redirect = {
      destination: '/login',
      permanent: false,
    };
    const getServerSideProps = withGTServerSideProps(
      async (_context: GetServerSidePropsContext) => ({
        redirect,
      })
    );

    await expect(getServerSideProps(context)).resolves.toEqual({ redirect });
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });
});

describe('withGTStaticProps', () => {
  const context = {
    locale: 'fr',
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en',
  } as GetStaticPropsContext;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    mockTranslationSnapshots();
  });

  it('adds only the generated locale and its translations', async () => {
    const getStaticProps = withGTStaticProps();

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        locale: 'fr',
        translations: { fr: { hash: 'fr translation' } },
      },
    });
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledOnce();
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
  });

  it('requires Pages Router locale routing', async () => {
    const getStaticProps = withGTStaticProps();

    await expect(getStaticProps({} as GetStaticPropsContext)).rejects.toThrow(
      'gt-next Error: withGTStaticProps() could not determine the statically generated locale because without Pages Router locale routing, Next.js generates only one version of this page. Add i18n locales and defaultLocale to your Next.js configuration.'
    );
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to context.defaultLocale when context.locale is unavailable', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const getStaticProps = withGTStaticProps();

    await expect(
      getStaticProps({ defaultLocale: 'en' } as GetStaticPropsContext)
    ).resolves.toEqual({
      props: {
        locale: 'en',
        translations: {},
      },
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Next.js did not provide an active Pages Router locale'
      )
    );
    consoleWarnSpy.mockRestore();
  });

  it('generates an isolated translation snapshot for each locale context', async () => {
    const pageGetStaticProps = vi.fn(
      async (currentContext: GetStaticPropsContext) => ({
        props: {
          greeting: `Greeting for ${currentContext.locale}`,
        },
      })
    );
    const getStaticProps = withGTStaticProps(pageGetStaticProps);

    await expect(
      Promise.all([
        getStaticProps({ ...context, locale: 'fr' }),
        getStaticProps({ ...context, locale: 'es' }),
      ])
    ).resolves.toEqual([
      {
        props: {
          greeting: 'Greeting for fr',
          locale: 'fr',
          translations: { fr: { hash: 'fr translation' } },
        },
      },
      {
        props: {
          greeting: 'Greeting for es',
          locale: 'es',
          translations: { es: { hash: 'es translation' } },
        },
      },
    ]);
    expect(pageGetStaticProps).toHaveBeenCalledTimes(2);
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('es');
  });

  it('uses an empty translation snapshot for the default locale', async () => {
    const getStaticProps = withGTStaticProps();

    await expect(getStaticProps({ ...context, locale: 'en' })).resolves.toEqual(
      {
        props: {
          locale: 'en',
          translations: {},
        },
      }
    );
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });

  it('preserves incremental static regeneration options', async () => {
    const getStaticProps = withGTStaticProps(
      async (_context: GetStaticPropsContext) => ({
        props: {
          renderedAt: 'build',
        },
        revalidate: 60,
      })
    );

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        renderedAt: 'build',
        locale: 'fr',
        translations: { fr: { hash: 'fr translation' } },
      },
      revalidate: 60,
    });
  });

  it('preserves redirects without loading translations', async () => {
    const redirect = {
      destination: '/login',
      permanent: false,
    };
    const getStaticProps = withGTStaticProps(
      async (_context: GetStaticPropsContext) => ({
        redirect,
      })
    );

    await expect(getStaticProps(context)).resolves.toEqual({ redirect });
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });

  it('preserves notFound results without loading translations', async () => {
    const getStaticProps = withGTStaticProps(
      async (_context: GetStaticPropsContext) => ({
        notFound: true,
      })
    );

    await expect(getStaticProps(context)).resolves.toEqual({ notFound: true });
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });
});
