import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compatPluginModule,
  mockClientConditionStore,
  mockGetTranslationsInternal,
  mockInitializeDictionaryManager,
  mockIsDictionaryManagerInitialized,
} = vi.hoisted(() => ({
  compatPluginModule: {
    dictionary: { greeting: 'Hello' },
    loadDictionary: async () => ({ greeting: 'Bonjour' }),
  },
  mockClientConditionStore: {
    getLocale: vi.fn(() => 'es'),
    getEnableI18n: vi.fn(() => false),
  },
  mockGetTranslationsInternal: vi.fn(async () => 'translations'),
  mockInitializeDictionaryManager: vi.fn(),
  mockIsDictionaryManagerInitialized: vi.fn(() => false),
}));

vi.mock('gt-tanstack-start/internal/_config', () => ({
  config: { defaultLocale: 'en', locales: ['en', 'fr'] },
}));
vi.mock('gt-tanstack-start/internal/_compat-config', () => compatPluginModule);

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockClientConditionStore,
}));

vi.mock('gt-i18n/internal', () => ({
  getTranslationsInternal: mockGetTranslationsInternal,
  initializeDictionaryManager: mockInitializeDictionaryManager,
  isDictionaryManagerInitialized: mockIsDictionaryManagerInitialized,
}));

vi.mock('gt-react/compat', () => ({
  GTDictionaryProvider: vi.fn(),
  useTranslations: vi.fn(),
}));

import { getTranslations } from '../../compat.client';

describe.sequential('gt-tanstack-start/compat (browser)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDictionaryManagerInitialized.mockReturnValue(false);
  });

  it('initializes the dictionary manager from the plugin before translating', async () => {
    await expect(getTranslations('metadata')).resolves.toBe('translations');

    expect(mockInitializeDictionaryManager).toHaveBeenCalledWith({
      dictionary: compatPluginModule.dictionary,
      loadDictionary: compatPluginModule.loadDictionary,
      cacheExpiryTime: null,
    });
    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: false,
      rootId: 'metadata',
    });
  });
});
