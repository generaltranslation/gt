import { describe, expect, it, vi } from 'vitest';
import { getLocale } from '../../../functions/locale-operations';
import { initializeGT } from '../../../setup/initializeGT';
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

  it('preserves default locale dialects through browser setup', () => {
    initializeGT({
      defaultLocale: 'pt-BR',
      locales: ['pt', 'fr'],
      getLocale: () => 'pt-BR',
      loadTranslations: vi.fn(),
    });

    expect(getLocale()).toBe('pt-BR');
  });
});
