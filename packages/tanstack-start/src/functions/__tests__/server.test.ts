import { describe, expect, it, vi } from 'vitest';

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

import { getConditionStore } from '../../condition-store/singleton';
import { getGT, getMessages, getTranslations } from '../server';

describe('server translation functions', () => {
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
