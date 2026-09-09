import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClientConditionStore,
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetRequest,
  mockGetTranslationsInternal,
  runtime,
} = vi.hoisted(() => ({
  mockClientConditionStore: {
    getLocale: vi.fn(() => 'es'),
    getEnableI18n: vi.fn(() => true),
  },
  mockGetGTInternal: vi.fn(async () => 'gt'),
  mockGetMessagesInternal: vi.fn(async () => 'messages'),
  mockGetRequest: vi.fn(),
  mockGetTranslationsInternal: vi.fn(async () => 'translations'),
  runtime: { target: 'server' as 'server' | 'client' },
}));

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: (serverFn: (...args: never[]) => unknown) => ({
      client:
        (clientFn: (...args: never[]) => unknown) =>
        (...args: never[]) =>
          runtime.target === 'server' ? serverFn(...args) : clientFn(...args),
    }),
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => mockGetRequest(),
  setCookie: vi.fn(),
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

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { initializeRequestConditions } from '../requestConditions';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
  getTranslations,
} from '../runtime';

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
};

describe.sequential('isomorphic translation functions', () => {
  beforeEach(() => {
    initializeI18nConfig(config);
    initializeRequestConditions();
    runtime.target = 'server';
    mockGetRequest.mockReset();
    mockClientConditionStore.getLocale.mockClear();
    mockClientConditionStore.getEnableI18n.mockClear();
    mockGetGTInternal.mockClear();
    mockGetMessagesInternal.mockClear();
    mockGetTranslationsInternal.mockClear();
  });

  it('reads conditions directly from the current TanStack request', async () => {
    const messages = [{ message: 'Hello' }];
    mockGetRequest.mockReturnValue(
      new Request('https://example.com', {
        headers: {
          cookie:
            'generaltranslation.locale=fr; generaltranslation.region=FR; generaltranslation.enable-i18n=false',
        },
      })
    );

    expect(getLocale()).toBe('fr');
    expect(getEnableI18n()).toBe(false);
    await expect(getGT(messages)).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');
    await expect(getTranslations('metadata')).resolves.toBe('translations');

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
    runtime.target = 'client';
    const messages = [{ message: 'Hello' }];

    expect(getLocale()).toBe('es');
    expect(getEnableI18n()).toBe(true);
    await expect(getGT(messages)).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');
    await expect(getTranslations('metadata')).resolves.toBe('translations');

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
