import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInitializeI18nConfig,
  mockIsI18nConfigInitialized,
  mockIsNextI18nCacheInitialized,
  mockNextI18nCacheConstructor,
  mockSetNextI18nCache,
  mockSetupGTServicesEnabled,
} = vi.hoisted(() => ({
  mockInitializeI18nConfig: vi.fn(),
  mockIsI18nConfigInitialized: vi.fn(),
  mockIsNextI18nCacheInitialized: vi.fn(),
  mockNextI18nCacheConstructor: vi.fn(),
  mockSetNextI18nCache: vi.fn(),
  mockSetupGTServicesEnabled: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  initializeI18nConfig: mockInitializeI18nConfig,
  isI18nConfigInitialized: mockIsI18nConfigInitialized,
  setupGTServicesEnabled: mockSetupGTServicesEnabled,
}));

vi.mock('../../i18n-cache/NextI18nCache', () => ({
  isNextI18nCacheInitialized: mockIsNextI18nCacheInitialized,
  NextI18nCache: class {
    constructor(params: unknown) {
      mockNextI18nCacheConstructor(params);
    }
  },
  setNextI18nCache: mockSetNextI18nCache,
}));

describe('initializeGT', () => {
  const params = {
    i18nConfigParams: {
      defaultLocale: 'en',
    },
    gtservicesEnabledParams: {
      projectId: 'project-id',
    },
    nextI18nCacheParams: {
      projectId: 'project-id',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsI18nConfigInitialized.mockReturnValue(false);
    mockIsNextI18nCacheInitialized.mockReturnValue(false);
  });

  it('initializes Next i18n singletons', async () => {
    const { initializeGT } = await import('../initGT');

    initializeGT(params);

    expect(mockSetupGTServicesEnabled).toHaveBeenCalledWith(
      params.gtservicesEnabledParams
    );
    expect(mockInitializeI18nConfig).toHaveBeenCalledWith(
      params.i18nConfigParams
    );
    expect(mockNextI18nCacheConstructor).toHaveBeenCalledWith(
      params.nextI18nCacheParams
    );
    expect(mockSetNextI18nCache).toHaveBeenCalled();
  });

  it('skips when shared Next i18n singletons already exist', async () => {
    mockIsI18nConfigInitialized.mockReturnValue(true);
    mockIsNextI18nCacheInitialized.mockReturnValue(true);
    const { initializeGT } = await import('../initGT');

    initializeGT(params);

    expect(mockSetupGTServicesEnabled).not.toHaveBeenCalled();
    expect(mockInitializeI18nConfig).not.toHaveBeenCalled();
    expect(mockNextI18nCacheConstructor).not.toHaveBeenCalled();
    expect(mockSetNextI18nCache).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing config when only cache is missing', async () => {
    mockIsI18nConfigInitialized.mockReturnValue(true);
    const { initializeGT } = await import('../initGT');

    initializeGT(params);

    expect(mockSetupGTServicesEnabled).not.toHaveBeenCalled();
    expect(mockInitializeI18nConfig).not.toHaveBeenCalled();
    expect(mockNextI18nCacheConstructor).toHaveBeenCalledWith(
      params.nextI18nCacheParams
    );
    expect(mockSetNextI18nCache).toHaveBeenCalled();
  });
});
