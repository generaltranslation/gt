import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { getLocale } from '../../../functions/locale-operations';
import { initializeGT } from '../../../setup/initializeGT';
import { determineLocale } from '../determineLocale';

describe('determineLocale', () => {
  beforeEach(() => {
    initializeI18nConfig();
  });

  it('resolves custom locale aliases returned by getLocale', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });
    warnSpy.mockClear();

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
    initializeI18nConfig({
      defaultLocale: 'pt-BR',
      locales: ['pt', 'fr'],
    });
    initializeGT({
      defaultLocale: 'pt-BR',
      locales: ['pt', 'fr'],
      getLocale: () => 'pt-BR',
      loadTranslations: vi.fn(),
    });

    expect(getLocale()).toBe('pt-BR');
  });
});
