import type { GetStaticPropsContext } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTranslationsSnapshot = vi.hoisted(() => vi.fn());
const mockGetI18nConfig = vi.hoisted(() => vi.fn());

vi.mock('gt-react', () => ({
  getTranslationsSnapshot: (...args: unknown[]) =>
    mockGetTranslationsSnapshot(...args),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: () => mockGetI18nConfig(),
}));

import { withGTStaticProps } from '../withGTStaticProps';

const context = {
  locale: 'fr',
  defaultLocale: 'en',
} as GetStaticPropsContext;

describe('withGTStaticProps', () => {
  beforeEach(() => {
    mockGetI18nConfig.mockReset();
    mockGetI18nConfig.mockReturnValue({
      getDefaultLocale: () => 'en',
    });
    mockGetTranslationsSnapshot.mockReset();
    mockGetTranslationsSnapshot.mockResolvedValue({ fr: { hash: 'Bonjour' } });
  });

  it('adds locale and translations without a page handler', async () => {
    const getStaticProps = withGTStaticProps();

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        locale: 'fr',
        translations: { fr: { hash: 'Bonjour' } },
      },
    });
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
  });

  it('merges locale and translations with page props', async () => {
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
        translations: { fr: { hash: 'Bonjour' } },
      },
      revalidate: 60,
    });
  });

  it('uses an explicit locale parameter', async () => {
    mockGetTranslationsSnapshot.mockResolvedValue({ es: { hash: 'Hola' } });
    const getStaticProps = withGTStaticProps('es');

    await expect(getStaticProps(context)).resolves.toEqual({
      props: {
        locale: 'es',
        translations: { es: { hash: 'Hola' } },
      },
    });
    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('es');
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
});
