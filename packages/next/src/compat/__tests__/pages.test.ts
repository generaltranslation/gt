import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetServerSidePropsContext, GetStaticPropsContext } from 'next';

const { mockLoadDictionaries } = vi.hoisted(() => ({
  mockLoadDictionaries: vi.fn(),
}));

vi.mock('../dictionaries', () => ({
  loadDictionaries: mockLoadDictionaries,
}));

// The root helpers resolve the locale and translations; these stand-ins add
// them the same way, so the tests cover only what /compat adds.
function withGTProps(
  getProps?: (
    context: unknown
  ) => Promise<{ props: Record<string, unknown> } | { notFound: true }>
) {
  return async (context: unknown) => {
    const result = getProps ? await getProps(context) : { props: {} };
    if (!('props' in result)) return result;
    return {
      ...result,
      props: { ...result.props, locale: 'fr', translations: { fr: {} } },
    };
  };
}
vi.mock('../../pages-dir/withGTServerSideProps', () => ({
  withGTServerSideProps: withGTProps,
}));
vi.mock('../../pages-dir/withGTStaticProps', () => ({
  withGTStaticProps: withGTProps,
}));

const { withGTServerSideProps, withGTStaticProps } = await import('../pages');

const dictionaries = { fr: { greeting: 'Bonjour' }, en: { greeting: 'Hello' } };

describe('compat Pages Router helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadDictionaries.mockResolvedValue(dictionaries);
  });

  it("add the page locale's dictionaries to server-side props", async () => {
    const result = await withGTServerSideProps(async () => ({
      props: { page: 'home' },
    }))({} as GetServerSidePropsContext);

    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr');
    expect(result).toEqual({
      props: {
        page: 'home',
        locale: 'fr',
        translations: { fr: {} },
        dictionaries,
      },
    });
  });

  it("add the page locale's dictionaries to static props", async () => {
    const result = await withGTStaticProps(async () => ({
      props: { page: 'home' },
      revalidate: 60,
    }))({} as GetStaticPropsContext);

    expect(result).toEqual({
      props: {
        page: 'home',
        locale: 'fr',
        translations: { fr: {} },
        dictionaries,
      },
      revalidate: 60,
    });
  });

  it('pass through results without props', async () => {
    const result = await withGTServerSideProps(async () => ({
      notFound: true as const,
    }))({} as GetServerSidePropsContext);

    expect(result).toEqual({ notFound: true });
    expect(mockLoadDictionaries).not.toHaveBeenCalled();
  });
});
