import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tx } from '../tx';

const { mockTxInternal } = vi.hoisted(() => ({
  mockTxInternal: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  txInternal: mockTxInternal,
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: vi.fn().mockResolvedValue({
    _locale: 'fr',
    _enableI18n: true,
  }),
}));

describe('tx', () => {
  beforeEach(() => {
    mockTxInternal.mockReset();
  });

  it('forwards request conditions and options to txInternal', async () => {
    mockTxInternal.mockResolvedValue('Bonjour');

    await expect(
      tx('Hello', {
        $locale: 'fr',
        $maxChars: -12,
      })
    ).resolves.toBe('Bonjour');

    expect(mockTxInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: true,
      content: 'Hello',
      options: {
        $locale: 'fr',
        $maxChars: -12,
      },
    });
  });
});
