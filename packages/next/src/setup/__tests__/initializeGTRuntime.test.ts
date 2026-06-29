import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCoreInitializeGT, mockGetParams } = vi.hoisted(() => ({
  mockCoreInitializeGT: vi.fn(),
  mockGetParams: vi.fn(),
}));

vi.mock('../initGT', () => ({
  initializeGT: mockCoreInitializeGT,
}));

vi.mock('../shared', () => ({
  getParams: mockGetParams,
}));

describe('initializeGTRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParams.mockReturnValue({
      i18nConfigParams: {},
      gtservicesEnabledParams: {},
      nextI18nCacheParams: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves server cache expiry behavior during SSR', async () => {
    const { initializeGTRuntime } = await import('../initializeGTRuntime');

    initializeGTRuntime();

    expect(mockCoreInitializeGT).toHaveBeenCalledWith({
      i18nConfigParams: {},
      gtservicesEnabledParams: {},
      nextI18nCacheParams: {},
    });
  });

  it('defaults browser cache expiry to no expiry', async () => {
    vi.stubGlobal('window', {});
    const { initializeGTRuntime } = await import('../initializeGTRuntime');

    initializeGTRuntime();

    expect(mockCoreInitializeGT).toHaveBeenCalledWith({
      i18nConfigParams: {},
      gtservicesEnabledParams: {},
      nextI18nCacheParams: {
        cacheExpiryTime: null,
      },
    });
  });

  it('lets explicit cache expiry override the browser default', async () => {
    vi.stubGlobal('window', {});
    mockGetParams.mockReturnValue({
      i18nConfigParams: {},
      gtservicesEnabledParams: {},
      nextI18nCacheParams: {
        cacheExpiryTime: 30000,
      },
    });
    const { initializeGTRuntime } = await import('../initializeGTRuntime');

    initializeGTRuntime();

    expect(mockCoreInitializeGT).toHaveBeenCalledWith({
      i18nConfigParams: {},
      gtservicesEnabledParams: {},
      nextI18nCacheParams: {
        cacheExpiryTime: 30000,
      },
    });
  });
});
