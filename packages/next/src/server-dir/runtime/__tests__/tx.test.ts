import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tx } from '../tx';

const { mockLookupTranslation, mockTranslate } = vi.hoisted(() => ({
  mockLookupTranslation: vi.fn(),
  mockTranslate: vi.fn(),
}));

vi.mock('../../../config-dir/getI18NConfig', () => ({
  getI18NConfig: () => ({
    requiresTranslation: () => [true, false],
    lookupTranslation: mockLookupTranslation,
    translate: mockTranslate,
  }),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: () => ({
    getDefaultLocale: () => 'en',
    getGTClass: () => ({
      formatMessage: (message: string) => message,
      formatCutoff: (message: string) => message,
    }),
  }),
}));

vi.mock('../../../request/getLocale', () => ({
  getLocale: vi.fn().mockResolvedValue('fr'),
}));

describe('tx', () => {
  beforeEach(() => {
    mockLookupTranslation.mockReset();
    mockTranslate.mockReset();
  });

  it('normalizes negative maxChars before forwarding lookup options', async () => {
    mockLookupTranslation.mockReturnValue('Bonjour');

    await expect(
      tx('Hello', {
        $locale: 'fr',
        $maxChars: -12,
      })
    ).resolves.toBe('Bonjour');

    expect(mockLookupTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          $maxChars: 12,
        }),
      })
    );
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});
