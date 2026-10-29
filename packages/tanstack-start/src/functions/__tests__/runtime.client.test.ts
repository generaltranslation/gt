import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClientConditionStore, mockGetGTInternal, mockGetMessagesInternal } =
  vi.hoisted(() => ({
    mockClientConditionStore: {
      getLocale: vi.fn(() => 'es'),
      getEnableI18n: vi.fn(() => false),
    },
    mockGetGTInternal: vi.fn(async () => 'gt'),
    mockGetMessagesInternal: vi.fn(async () => 'messages'),
  }));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockClientConditionStore,
}));

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
}));

import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../runtime.client';

describe.sequential('browser translation functions', () => {
  beforeEach(() => {
    mockGetGTInternal.mockClear();
    mockGetMessagesInternal.mockClear();
  });

  it('reads conditions from the browser condition store', async () => {
    const messages = [{ message: 'Hello' }];

    expect(getLocale()).toBe('es');
    expect(getEnableI18n()).toBe(false);
    await expect(getGT(messages)).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      { locale: 'es', enableI18n: false },
      messages
    );
    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: false,
    });
  });
});
