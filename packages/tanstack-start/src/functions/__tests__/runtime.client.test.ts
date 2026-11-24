import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClientConditionStore, mockLoadClientGTParams } = vi.hoisted(() => ({
  mockClientConditionStore: {
    getLocale: vi.fn(() => 'es'),
    getEnableI18n: vi.fn(() => false),
  },
  mockLoadClientGTParams: vi.fn(async () => ({})),
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockClientConditionStore,
}));

vi.mock('../../setup/translations.client', () => ({
  loadClientGTParams: mockLoadClientGTParams,
}));

vi.mock('gt-i18n/internal', () => ({
  createGT: () => 'gt',
  createMessages: () => 'messages',
}));

import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../runtime.client';

describe.sequential('browser translation functions', () => {
  beforeEach(() => {
    mockLoadClientGTParams.mockClear();
  });

  it('reads conditions from the browser condition store', async () => {
    expect(getLocale()).toBe('es');
    expect(getEnableI18n()).toBe(false);
    await expect(getGT()).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');

    expect(mockLoadClientGTParams).toHaveBeenCalledTimes(2);
    expect(mockLoadClientGTParams).toHaveBeenCalledWith({
      locale: 'es',
      enableI18n: false,
    });
  });
});
