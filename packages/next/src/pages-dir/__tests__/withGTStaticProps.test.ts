import type { GetStaticPropsContext } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const mockGetTranslationsSnapshot = vi.hoisted(() => vi.fn());

vi.mock('gt-react', () => ({
  getTranslationsSnapshot: (...args: unknown[]) =>
    mockGetTranslationsSnapshot(...args),
}));

import { withGTStaticProps } from '../withGTStaticProps';

const context = {
  locale: 'fr',
  locales: ['en', 'fr', 'es'],
  defaultLocale: 'en',
} as GetStaticPropsContext;

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('withGTStaticProps', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    mockGetTranslationsSnapshot.mockReset();
    mockGetTranslationsSnapshot.mockImplementation(async (locale: string) => ({
      [locale]: { hash: `${locale} translation` },
    }));
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
