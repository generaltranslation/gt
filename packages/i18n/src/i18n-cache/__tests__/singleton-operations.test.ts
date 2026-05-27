import { describe, expect, it, vi } from 'vitest';

describe('i18n cache singleton operations', () => {
  it('throws when the i18n cache has not been initialized', async () => {
    vi.resetModules();
    const { getI18nCache } = await import('../singleton-operations');

    expect(() => getI18nCache()).toThrow(
      'getI18nCache(): I18nCache was not initialized. Call initializeGT() before accessing I18nCache.'
    );
  });
});
