import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compatPluginModule, mockGetTranslationsInternal } = vi.hoisted(() => ({
  compatPluginModule: {
    dictionary: { greeting: 'Hello' },
    loadDictionary: async () => ({ greeting: 'Bonjour' }),
  },
  mockGetTranslationsInternal: vi.fn(async () => 'translations'),
}));

vi.mock('gt-tanstack-start/internal/_compat-config', () => compatPluginModule);

vi.mock('gt-i18n/internal/compat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal/compat')>()),
  getTranslationsInternal: mockGetTranslationsInternal,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => {
    throw new Error('No StartEvent found in AsyncLocalStorage.');
  }),
  setCookie: vi.fn(),
}));

import { getRequest } from '@tanstack/react-start/server';
import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import { getDictionaryManager } from 'gt-i18n/internal/compat';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { getTranslations } from '../../compat.server';

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
};

describe.sequential('gt-tanstack-start/compat (server)', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    internalInitializeGTSRA({ ...config, loadTranslations: async () => ({}) });
    setConditionStore(new AsyncLocalConditionStore(config));
    mockGetTranslationsInternal.mockClear();
  });

  it('passes request conditions to getTranslationsInternal', async () => {
    vi.mocked(getRequest).mockReturnValue(
      new Request('https://example.com', {
        headers: {
          cookie:
            'generaltranslation.locale=fr; generaltranslation.enable-i18n=false',
        },
      })
    );

    await expect(getTranslations('metadata')).resolves.toBe('translations');
    vi.mocked(getRequest).mockRestore();

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: 'metadata',
    });
  });

  it("initializes the dictionary manager from the plugin's dictionary", async () => {
    vi.mocked(getRequest).mockReturnValue(new Request('https://example.com'));

    await getTranslations();
    vi.mocked(getRequest).mockRestore();

    expect(getDictionaryManager().lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
  });
});
