import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClientConditionStore, mockGetGT, mockGetMessages } = vi.hoisted(
  () => ({
    mockClientConditionStore: {
      getLocale: vi.fn(() => 'es'),
      getEnableI18n: vi.fn(() => false),
    },
    mockGetGT: vi.fn(async () => 'gt'),
    mockGetMessages: vi.fn(async () => 'messages'),
  })
);

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockClientConditionStore,
}));

vi.mock('gt-i18n/internal', () => ({
  getGT: mockGetGT,
  getMessages: mockGetMessages,
}));

import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../runtime.client';

describe.sequential('browser translation functions', () => {
  beforeEach(() => {
    mockGetGT.mockClear();
    mockGetMessages.mockClear();
  });

  it('reads conditions from the browser condition store', async () => {
    expect(getLocale()).toBe('es');
    expect(getEnableI18n()).toBe(false);
    await expect(getGT()).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');

    expect(mockGetGT).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: false,
    });
    expect(mockGetMessages).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: false,
    });
  });
});
