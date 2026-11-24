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
  mockPlaceholder,
} = vi.hoisted(() => ({
  mockPlaceholder: { filled: '__gt_next_server_only_hashes_q7Zk2W__[]' },
  mockGetI18nConfig: vi.fn(),
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockGetRegion: vi.fn(),
  mockLoadTranslations: vi.fn(),
  mockClientGTProvider: vi.fn(),
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
  }),
}));

vi.mock('../../utils/client-boundary', () => ({
  Client_GTProvider: mockClientGTProvider,
}));

// The literal as a build with experimentalSplitTranslations leaves it.
vi.mock('../serverOnlyHashesPlaceholder', () => ({
  get SERVER_ONLY_HASHES_PLACEHOLDER() {
    return mockPlaceholder.filled;
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

    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({
      children: 'content',
    });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadTranslations).not.toHaveBeenCalled();
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
