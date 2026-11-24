import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';

const {
  mockGetI18nConfig,
  mockGetEnableI18n,
  mockGetLocale,
  mockGetRegion,
  mockLoadTranslations,
  mockClientGTProvider,
  mockClientTranslationsSeed,
  mockGetLookupTranslation,
  mockPlaceholder,
} = vi.hoisted(() => ({
  mockPlaceholder: {
    filled: '__gt_next_server_only_hashes_q7Zk2W__[]',
    pages: '__gt_next_page_hashes_q7Zk2W__[]',
  },
  mockGetI18nConfig: vi.fn(),
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockGetRegion: vi.fn(),
  mockLoadTranslations: vi.fn(),
  mockClientGTProvider: vi.fn(),
  mockClientTranslationsSeed: vi.fn(),
  mockGetLookupTranslation: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../request/getEnableI18n', () => ({
  getEnableI18n: mockGetEnableI18n,
}));

vi.mock('../../request/getRegion', () => ({
  getRegion: mockGetRegion,
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReactI18nCache: () => ({
    loadTranslations: mockLoadTranslations,
    getLookupTranslation: mockGetLookupTranslation,
  }),
}));

vi.mock('../../utils/client-boundary', () => ({
  Client_GTProvider: mockClientGTProvider,
  Client_TranslationsSeed: mockClientTranslationsSeed,
}));

// The literal as a build with experimentalSplitTranslations leaves it.
vi.mock('../splitTranslationsPlaceholders', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get SERVER_ONLY_HASHES_PLACEHOLDER() {
    return mockPlaceholder.filled;
  },
  get PAGE_HASHES_PLACEHOLDER() {
    return mockPlaceholder.pages;
  },
}));

describe('GTProvider', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocale.mockResolvedValue('fr');
    mockGetRegion.mockResolvedValue(undefined);
    mockGetEnableI18n.mockResolvedValue(true);
    mockLoadTranslations.mockResolvedValue({
      hash: 'Salut',
    });
    mockGetI18nConfig.mockReturnValue({
      requiresTranslation: vi.fn().mockReturnValue(true),
    });
  });

  it('passes locale-scoped snapshots to gt-react GTProvider', async () => {
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: {
        children: 'content',
        enableI18n: true,
        locale: 'fr',
        region: undefined,
        translations: {
          fr: {
            hash: 'Salut',
          },
        },
      },
    });
  });

  it('sends every translation while the build listed no server-only message', async () => {
    mockLoadTranslations.mockResolvedValue({ hash: 'Salut' });
    const { getGTProviderProps } = await import('../GTProvider');

    expect((await getGTProviderProps('fr')).translations).toEqual({
      fr: { hash: 'Salut' },
    });
  });

  it('leaves out the translations of the messages the build listed as server-only', async () => {
    mockPlaceholder.filled =
      '__gt_next_server_only_hashes_q7Zk2W__[1111111111111111,3333333333333333]';
    vi.resetModules();
    onTestFinished(() => {
      mockPlaceholder.filled = '__gt_next_server_only_hashes_q7Zk2W__[]';
      vi.resetModules();
    });
    const catalog = {
      '1111111111111111': 'Serveur',
      '2222222222222222': 'Client',
      '3333333333333333': 'Serveur aussi',
    };
    const loaded = { ...catalog };
    mockLoadTranslations.mockResolvedValue(loaded);
    const { getGTProviderProps } = await import('../GTProvider');

    expect((await getGTProviderProps('fr')).translations).toEqual({
      fr: { '2222222222222222': 'Client' },
    });
    expect(loaded).toEqual(catalog);
  });

  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
  ])(
    'passes build-time locale refresh support %s as boolean %s',
    async (value, expected) => {
      vi.stubEnv(
        '_GENERALTRANSLATION_LOCALE_REFRESH_SUPPORTED',
        value as string | undefined
      );
      const { GTProvider } = await import('../GTProvider');
      const element = await GTProvider({ children: 'content' });
      expect(element.props.supportsLocaleRefresh).toBe(expected);
    }
  );

  it('uses the request locale and skips cached translations when translation is not required', async () => {
    const config = {
      requiresTranslation: vi.fn().mockReturnValue(false),
    };
    mockGetI18nConfig.mockReturnValue(config);
    mockGetLocale.mockResolvedValue('en');
    mockGetRegion.mockResolvedValue('US');
    mockGetEnableI18n.mockResolvedValue(false);
    const getClientTranslations = vi.fn();
    vi.doMock('../splitTranslations', () => ({ getClientTranslations }));
    vi.resetModules();
    onTestFinished(() => {
      vi.doUnmock('../splitTranslations');
      vi.resetModules();
    });

    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({
      children: 'content',
    });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadTranslations).not.toHaveBeenCalled();
    expect(getClientTranslations).not.toHaveBeenCalled();
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: {
        enableI18n: false,
        locale: 'en',
        region: 'US',
        translations: {
          en: {},
        },
      },
    });
  });
});

describe('split by page', () => {
  const catalog = {
    '1111111111111111': 'Serveur',
    '2222222222222222': 'Racine',
    '4444444444444444': 'Commandes',
    '5555555555555555': 'Commandes aussi',
    '6666666666666666': 'Panier',
  };
  // The lookup of the I18nCache, which reads the catalog without a copy.
  const lookup = (_content: unknown, options: { $_hash: string }) =>
    catalog[options.$_hash as keyof typeof catalog];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlaceholder.filled =
      '__gt_next_server_only_hashes_q7Zk2W__[1111111111111111]';
    mockPlaceholder.pages =
      '__gt_next_page_hashes_q7Zk2W__[app/%28shop%29/cart/page:6666666666666666;app/orders/page:4444444444444444,5555555555555555,7777777777777777]';
    vi.resetModules();
    mockGetLocale.mockResolvedValue('fr');
    mockGetRegion.mockResolvedValue(undefined);
    mockGetEnableI18n.mockResolvedValue(true);
    mockLoadTranslations.mockImplementation(async () => ({ ...catalog }));
    mockGetLookupTranslation.mockResolvedValue(lookup);
    mockGetI18nConfig.mockReturnValue({
      requiresTranslation: vi.fn().mockReturnValue(true),
    });
  });
  afterEach(() => {
    mockPlaceholder.filled = '__gt_next_server_only_hashes_q7Zk2W__[]';
    mockPlaceholder.pages = '__gt_next_page_hashes_q7Zk2W__[]';
    vi.resetModules();
  });

  it('seeds a page with the translations the build placed with it', async () => {
    const { GtSegment } = await import('../GtSegment');

    const element = await GtSegment({
      id: 'gt-next-page:app/orders/page',
      children: 'page',
    });

    expect(element).toMatchObject({
      type: mockClientTranslationsSeed,
      props: {
        children: 'page',
        translations: {
          fr: {
            '4444444444444444': 'Commandes',
            '5555555555555555': 'Commandes aussi',
          },
        },
      },
    });
    expect(mockGetLookupTranslation).toHaveBeenCalledWith('fr');
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });

  it.each([
    ['a page the build placed nothing with', 'gt-next-page:app/page', true],
    ['the default locale', 'gt-next-page:app/orders/page', false],
  ])(
    'renders the page alone for %s',
    async (_name, id, requiresTranslation) => {
      mockGetI18nConfig.mockReturnValue({
        requiresTranslation: vi.fn().mockReturnValue(requiresTranslation),
      });
      const { GtSegment } = await import('../GtSegment');

      expect(await GtSegment({ id, children: 'page' })).toBe('page');
      expect(mockGetLookupTranslation).not.toHaveBeenCalled();
    }
  );

  it('seeds nothing that a catalog which failed to load resolves to', async () => {
    mockGetLookupTranslation.mockResolvedValue((content: unknown) => content);
    const { GtSegment } = await import('../GtSegment');

    const element = await GtSegment({
      id: 'gt-next-page:app/orders/page',
      children: 'page',
    });

    expect(element.props.translations).toEqual({ fr: {} });
  });

  it('seeds a translation whose text is its hash', async () => {
    mockGetLookupTranslation.mockResolvedValue(
      (_content: unknown, options: { $_hash: string }) => options.$_hash
    );
    const { GtSegment } = await import('../GtSegment');

    const element = await GtSegment({
      id: 'gt-next-page:app/orders/page',
      children: 'page',
    });

    expect(element.props.translations).toEqual({
      fr: {
        '4444444444444444': '4444444444444444',
        '5555555555555555': '5555555555555555',
        '7777777777777777': '7777777777777777',
      },
    });
  });

  it('sends with the root and the seeds every translation it sent before', async () => {
    const { getGTProviderProps } = await import('../GTProvider');
    const { GtSegment } = await import('../GtSegment');

    const root = (await getGTProviderProps('fr')).translations.fr;
    const seeds = await Promise.all(
      ['app/orders/page', 'app/%28shop%29/cart/page'].map(
        async (page) =>
          (await GtSegment({ id: `gt-next-page:${page}` })).props.translations
            .fr
      )
    );

    expect(root).toEqual({ '2222222222222222': 'Racine' });
    expect(Object.assign({}, root, ...seeds)).toEqual({
      '2222222222222222': 'Racine',
      '4444444444444444': 'Commandes',
      '5555555555555555': 'Commandes aussi',
      '6666666666666666': 'Panier',
    });
  });
});
