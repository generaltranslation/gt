import { describe, expect, it, vi } from 'vitest';
import { determineLocale } from '../determineLocale';

describe('determineLocale', () => {
  it('resolves custom locale aliases returned by getLocale', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      determineLocale({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        customMapping: {
          'brand-french': {
            code: 'fr',
            name: 'Brand French',
          },
        },
        getLocale: () => 'brand-french',
      })
    ).toBe('fr');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
