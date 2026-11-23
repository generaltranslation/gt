import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockI18nCache } = vi.hoisted(() => ({
  mockI18nCache: {
    updateTranslations: vi.fn(),
  },
}));

// Run effects inline so GTProvider can be called as a plain function
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => {
    effect();
  },
}));

vi.mock('gt-react', () => ({ GTProvider: () => null }));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReactI18nCache: () => mockI18nCache,
}));

vi.mock('../../setup/initializeGT.client', () => ({
  getClientReload: () => undefined,
}));

import { GTProvider } from '../GTProvider.client';

// Sequential: these tests stub NODE_ENV and share the cache mock
describe.sequential('GTProvider client', () => {
  afterEach(() => {
    mockI18nCache.updateTranslations.mockReset();
    vi.unstubAllEnvs();
  });

  it('seeds the production i18nCache with the provider translations', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const translations = { fr: { hash: 'Bonjour' } };

    GTProvider({ locale: 'fr', translations });

    expect(mockI18nCache.updateTranslations).toHaveBeenCalledWith(translations);
  });

  it('leaves the i18nCache to the i18nStore in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    GTProvider({ locale: 'fr', translations: { fr: {} } });

    expect(mockI18nCache.updateTranslations).not.toHaveBeenCalled();
  });
});
