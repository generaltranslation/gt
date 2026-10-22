import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientConditionStore,
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetTranslationsInternal,
} = vi.hoisted(() => ({
  mockClientConditionStore: {
    getLocale: vi.fn(() => 'es'),
    getEnableI18n: vi.fn(() => true),
  },
  mockGetGTInternal: vi.fn(async () => 'gt'),
  mockGetMessagesInternal: vi.fn(async () => 'messages'),
  mockGetTranslationsInternal: vi.fn(async () => 'translations'),
}));

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: (serverFn: (...args: never[]) => unknown) => ({
      client: (clientFn: (...args: never[]) => unknown) =>
        Object.assign(serverFn, { client: clientFn, server: serverFn }),
    }),
  }),
}));

vi.mock('@generaltranslation/react-core/pure', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@generaltranslation/react-core/pure')
  >()),
  getReadonlyConditionStore: () => mockClientConditionStore,
}));

vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal')>()),
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
  getTranslationsInternal: mockGetTranslationsInternal,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => {
    throw new Error('No StartEvent found in AsyncLocalStorage.');
  }),
  setCookie: vi.fn(),
}));

import { getRequest } from '@tanstack/react-start/server';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
  getTranslations,
} from '../runtime.server';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    tanstackStart?: Record<string, unknown>;
  };
};

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
};

function resetSingletons() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

describe.sequential('isomorphic translation functions', () => {
  beforeEach(() => {
    resetSingletons();
    initializeI18nConfig(config);
    setConditionStore(new AsyncLocalConditionStore(config));
    mockClientConditionStore.getLocale.mockClear();
    mockClientConditionStore.getEnableI18n.mockClear();
    mockGetGTInternal.mockClear();
    mockGetMessagesInternal.mockClear();
    mockGetTranslationsInternal.mockClear();
  });

  it('requires a TanStack Start request', () => {
    expect(() => getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });

  it('passes request conditions to the internal translation functions', async () => {
    const messages = [{ message: 'Hello' }];

    vi.mocked(getRequest).mockReturnValue(
      new Request('https://example.com', {
        headers: {
          cookie:
            'generaltranslation.locale=fr; generaltranslation.region=FR; generaltranslation.enable-i18n=false',
        },
      })
    );

    await expect(getGT(messages)).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');
    await expect(getTranslations('metadata')).resolves.toBe('translations');
    vi.mocked(getRequest).mockRestore();

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      { locale: 'fr', enableI18n: false },
      messages
    );
    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: 'metadata',
    });
  });

  it('reads browser conditions in the browser', () => {
    const clientGetLocale = (
      getLocale as unknown as { client: typeof getLocale }
    ).client;
    const clientGetEnableI18n = (
      getEnableI18n as unknown as { client: typeof getEnableI18n }
    ).client;

    expect(clientGetLocale()).toBe('es');
    expect(clientGetEnableI18n()).toBe(true);
  });
});
