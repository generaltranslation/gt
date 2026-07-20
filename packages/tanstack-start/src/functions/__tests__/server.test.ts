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

import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import {
  getConditionStore,
  setConditionStore,
} from '../../condition-store/singleton';
import { getGT, getLocale, getMessages, getTranslations } from '../server';

type GlobalWithRegistry = {
  __generaltranslation?: {
    tanstackStart?: Record<string, unknown>;
  };
};

function resetConditionStoreSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

describe('server translation functions', () => {
  beforeEach(() => {
    resetConditionStoreSingleton();
    setConditionStore(new AsyncLocalConditionStore());
  });

  it('requires an active middleware request scope', () => {
    expect(() => getLocale()).toThrow(
      "Register gtMiddleware from 'gt-tanstack-start/server'"
    );
  });

  it('passes request conditions to the internal translation functions', async () => {
    const messages = [{ message: 'Hello' }];

    await getConditionStore().run(
      { locale: 'fr', region: 'FR', enableI18n: false },
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
