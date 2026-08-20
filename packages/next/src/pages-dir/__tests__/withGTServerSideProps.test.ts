import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const mockGetTranslationsSnapshot = vi.hoisted(() => vi.fn());

vi.mock('gt-react', () => ({
  getTranslationsSnapshot: (...args: unknown[]) =>
    mockGetTranslationsSnapshot(...args),
}));

import { withGTServerSideProps } from '../withGTServerSideProps';

const context = {
  locale: 'fr',
  defaultLocale: 'en',
  req: { cookies: {} },
} as GetServerSidePropsContext;

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('withGTServerSideProps', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    mockGetTranslationsSnapshot.mockReset();
    mockGetTranslationsSnapshot.mockImplementation(async (locale: string) => ({
      [locale]: { hash: `${locale} translation` },
    }));
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

  it('uses legacy request detection when context.locale is unavailable', async () => {
    const getServerSideProps = withGTServerSideProps();

    await expect(
      getServerSideProps({
        req: {
          headers: { 'accept-language': 'fr,en;q=0.8' },
          cookies: { 'generaltranslation.locale': 'es' },
        },
      } as GetServerSidePropsContext)
    ).resolves.toMatchObject({
      props: {
        locale: 'es',
        translations: { es: { hash: 'es translation' } },
      },
    });

    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('es');
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
