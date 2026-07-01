import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncConditionStoreParams } from '../../condition-store/AsyncConditionStore';
import { initializeGT } from '../initGT.rsc';

const mocks = vi.hoisted(() => ({
  coreInitializeGT: vi.fn(),
  setAsyncConditionStore: vi.fn(),
  conditionStoreParams: [] as AsyncConditionStoreParams[],
}));

vi.mock('../initGT', () => ({
  initializeGT: mocks.coreInitializeGT,
}));

vi.mock('../../condition-store/AsyncConditionStore', () => ({
  AsyncConditionStore: class MockAsyncConditionStore {
    constructor(params: AsyncConditionStoreParams) {
      mocks.conditionStoreParams.push(params);
    }
  },
  setAsyncConditionStore: mocks.setAsyncConditionStore,
}));

function createParams() {
  return {
    i18nConfigParams: {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    nextI18nCacheParams: {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    },
    privateConfig: {
      headersAndCookies: {
        localeHeaderName: 'x-gt-locale',
        localeCookieName: 'gt-locale',
      },
      ignoreBrowserLocales: true,
    },
  };
}

describe('initializeGT RSC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.conditionStoreParams.length = 0;
    Reflect.deleteProperty(
      process.env,
      '_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED'
    );
    Reflect.deleteProperty(
      process.env,
      '_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED'
    );
  });

  it('threads private config into the async condition store', () => {
    const params = createParams();

    initializeGT(params);

    expect(mocks.coreInitializeGT).toHaveBeenCalledWith({
      i18nConfigParams: params.i18nConfigParams,
      nextI18nCacheParams: params.nextI18nCacheParams,
    });
    expect(mocks.conditionStoreParams).toEqual([
      {
        headerName: 'x-gt-locale',
        cookieName: 'gt-locale',
        ignorePreferredLanguages: true,
        getLocale: undefined,
        getRegion: undefined,
      },
    ]);
    expect(mocks.setAsyncConditionStore).toHaveBeenCalledTimes(1);
  });

  it('wires configured custom locale and region getters', () => {
    process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED = 'true';
    process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED = 'true';

    initializeGT(createParams());

    const [conditionStoreParams] = mocks.conditionStoreParams;
    expect(conditionStoreParams.getLocale).toEqual(expect.any(Function));
    expect(conditionStoreParams.getRegion).toEqual(expect.any(Function));
  });
});
