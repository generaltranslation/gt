import { describe, expect, it, vi } from 'vitest';

const { mockGetEnableI18n, mockGetLocale, mockSetReadonlyConditionStore } =
  vi.hoisted(() => ({
    mockGetEnableI18n: vi.fn(),
    mockGetLocale: vi.fn(),
    mockSetReadonlyConditionStore: vi.fn(),
  }));

vi.mock('../getEnableI18n', () => ({
  getEnableI18n: mockGetEnableI18n,
}));

vi.mock('../getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('gt-react/context', () => ({
  setReadonlyConditionStore: mockSetReadonlyConditionStore,
}));

describe('withRequestConditions', () => {
  it('exposes async request conditions through a sync condition store', async () => {
    mockGetLocale.mockResolvedValue('fr');
    mockGetEnableI18n.mockResolvedValue(false);

    const { withRequestConditions } = await import('../asyncConditionStore');
    const result = await withRequestConditions((conditions) => {
      const conditionStore = mockSetReadonlyConditionStore.mock.calls[0][0];

      return {
        conditions,
        enableI18n: conditionStore.getEnableI18n(),
        locale: conditionStore.getLocale(),
      };
    });

    expect(result).toEqual({
      conditions: { locale: 'fr', enableI18n: false },
      enableI18n: false,
      locale: 'fr',
    });
  });
});
