import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetTranslationsInternal,
} = vi.hoisted(() => ({
  mockGetGTInternal: vi.fn(async () => 'gt'),
  mockGetMessagesInternal: vi.fn(async () => 'messages'),
  mockGetTranslationsInternal: vi.fn(async () => 'translations'),
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
import { getGT, getLocale, getMessages, getTranslations } from '../server';

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

describe.sequential('server translation functions', () => {
  beforeEach(() => {
    resetSingletons();
    initializeI18nConfig(config);
    setConditionStore(new AsyncLocalConditionStore(config));
  });

  it('requires an active middleware request scope', () => {
    expect(() => getLocale()).toThrow(
      "Register gtMiddleware from 'gt-tanstack-start/server'"
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
});
