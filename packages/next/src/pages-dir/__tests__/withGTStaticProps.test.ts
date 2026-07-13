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

  it('adds translations for every configured locale without a page handler', async () => {
    const getStaticProps = withGTStaticProps();

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        translations: {
          en: { hash: 'en translation' },
          fr: { hash: 'fr translation' },
          es: { hash: 'es translation' },
        },
      },
    });
    expect(mockGetTranslationsSnapshot).toHaveBeenNthCalledWith(1, 'en');
    expect(mockGetTranslationsSnapshot).toHaveBeenNthCalledWith(2, 'fr');
    expect(mockGetTranslationsSnapshot).toHaveBeenNthCalledWith(3, 'es');
  });

  it('merges every translation snapshot with page props', async () => {
    const pageGetStaticProps = vi.fn(
      async (currentContext: GetStaticPropsContext) => ({
        props: {
          greeting: `Greeting for ${currentContext.locale}`,
        },
      })
    );
    const getStaticProps = withGTStaticProps(pageGetStaticProps);

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        greeting: 'Greeting for fr',
        translations: {
          en: { hash: 'en translation' },
          fr: { hash: 'fr translation' },
          es: { hash: 'es translation' },
        },
      },
    });
    expect(pageGetStaticProps).toHaveBeenCalledWith(context);
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
        translations: {
          en: { hash: 'en translation' },
          fr: { hash: 'fr translation' },
          es: { hash: 'es translation' },
        },
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
