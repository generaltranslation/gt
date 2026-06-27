import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTranslationsSnapshot = vi.hoisted(() => vi.fn());
const mockParseLocale = vi.hoisted(() => vi.fn());

vi.mock('@generaltranslation/react-core/pure', () => ({
  getTranslationsSnapshot: (...args: unknown[]) =>
    mockGetTranslationsSnapshot(...args),
}));

vi.mock('../parseLocale', () => ({
  parseLocale: (...args: unknown[]) => mockParseLocale(...args),
}));

import { withGTServerSideProps } from '../withGTServerSideProps';

const context = { req: {} } as GetServerSidePropsContext;

describe('withGTServerSideProps', () => {
  beforeEach(() => {
    mockParseLocale.mockReset();
    mockParseLocale.mockReturnValue('fr');
    mockGetTranslationsSnapshot.mockReset();
    mockGetTranslationsSnapshot.mockResolvedValue({ fr: { hash: 'Bonjour' } });
  });

  it('adds locale and translations without a page handler', async () => {
    const getServerSideProps = withGTServerSideProps();

    await expect(getServerSideProps(context)).resolves.toEqual({
      props: {
        locale: 'fr',
        translations: { fr: { hash: 'Bonjour' } },
      },
    });
    expect(mockParseLocale).toHaveBeenCalledWith(context);
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
        translations: { fr: { hash: 'Bonjour' } },
      },
    });
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
    expect(mockParseLocale).not.toHaveBeenCalled();
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });
});
