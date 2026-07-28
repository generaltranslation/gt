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
  setCookie: vi.fn(),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import {
  getConditionStore,
  setConditionStore,
} from '../../condition-store/singleton';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
  getTranslations,
} from '../runtime';

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

  it('requires an active middleware request scope', () => {
    expect(() => getLocale()).toThrow(
      "Register gtMiddleware from 'gt-tanstack-start'"
    );
  });

  it('passes request conditions to the internal translation functions', async () => {
    const messages = [{ message: 'Hello' }];

    await getConditionStore().run(
      new Request('https://example.com', {
        headers: {
          cookie:
            'generaltranslation.locale=fr; generaltranslation.region=FR; generaltranslation.enable-i18n=false',
        },
      }),
      async () => {
        await expect(getGT(messages)).resolves.toBe('gt');
        await expect(getMessages()).resolves.toBe('messages');
        await expect(getTranslations('metadata')).resolves.toBe('translations');
      }
    );

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

  it('passes browser conditions to the internal translation functions', async () => {
    const clientGetLocale = (
      getLocale as unknown as { client: typeof getLocale }
    ).client;
    const clientGetEnableI18n = (
      getEnableI18n as unknown as { client: typeof getEnableI18n }
    ).client;
    const clientGetGT = (getGT as unknown as { client: typeof getGT }).client;
    const clientGetMessages = (
      getMessages as unknown as { client: typeof getMessages }
    ).client;
    const clientGetTranslations = (
      getTranslations as unknown as { client: typeof getTranslations }
    ).client;
    const messages = [{ message: 'Hello' }];

    expect(clientGetLocale()).toBe('es');
    expect(clientGetEnableI18n()).toBe(true);
    await expect(clientGetGT(messages)).resolves.toBe('gt');
    await expect(clientGetMessages()).resolves.toBe('messages');
    await expect(clientGetTranslations('metadata')).resolves.toBe(
      'translations'
    );

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      { locale: 'es', enableI18n: true },
      messages
    );
    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: true,
    });
    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: true,
      rootId: 'metadata',
    });
  });
});
