import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAsyncConditionStoreConstructor,
  mockCoreInitializeGT,
  mockIsAsyncConditionStoreInitialized,
  mockSetAsyncConditionStore,
} = vi.hoisted(() => ({
  mockAsyncConditionStoreConstructor: vi.fn(),
  mockCoreInitializeGT: vi.fn(),
  mockIsAsyncConditionStoreInitialized: vi.fn(),
  mockSetAsyncConditionStore: vi.fn(),
}));

vi.mock('../initGT', () => ({
  initializeGT: mockCoreInitializeGT,
}));

vi.mock('../../condition-store/AsyncConditionStore', () => ({
  AsyncConditionStore: class {
    constructor(params: unknown) {
      mockAsyncConditionStoreConstructor(params);
    }
  },
  isAsyncConditionStoreInitialized: mockIsAsyncConditionStoreInitialized,
  setAsyncConditionStore: mockSetAsyncConditionStore,
}));

vi.mock('../../errors/createErrors', () => ({
  customGetLocaleUnresolvedWarning: 'getLocale unresolved',
  customGetRegionUnresolvedWarning: 'getRegion unresolved',
}));

describe('initializeGT RSC', () => {
  let savedEnv: NodeJS.ProcessEnv;

  const params = {
    i18nConfigParams: {},
    gtservicesEnabledParams: {},
    nextI18nCacheParams: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    savedEnv = { ...process.env };
    mockIsAsyncConditionStoreInitialized.mockReturnValue(false);
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      headersAndCookies: {
        localeCookieName: 'gt-locale',
        localeHeaderName: 'x-gt-locale',
      },
      ignoreBrowserLocales: true,
    });
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('initializes shared i18n and async condition store', async () => {
    const { initializeGT } = await import('../initGT.rsc');

    initializeGT(params);

    expect(mockCoreInitializeGT).toHaveBeenCalledWith(params);
    expect(mockAsyncConditionStoreConstructor).toHaveBeenCalledWith({
      cookieName: 'gt-locale',
      getLocale: undefined,
      getRegion: undefined,
      headerName: 'x-gt-locale',
      ignorePreferredLanguages: true,
    });
    expect(mockSetAsyncConditionStore).toHaveBeenCalled();
  });

  it('skips async condition store when it already exists', async () => {
    mockIsAsyncConditionStoreInitialized.mockReturnValue(true);
    const { initializeGT } = await import('../initGT.rsc');

    initializeGT(params);

    expect(mockCoreInitializeGT).toHaveBeenCalledWith(params);
    expect(mockAsyncConditionStoreConstructor).not.toHaveBeenCalled();
    expect(mockSetAsyncConditionStore).not.toHaveBeenCalled();
  });
});
