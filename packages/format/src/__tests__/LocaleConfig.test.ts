import { describe, expect, it } from 'vitest';
import { LocaleConfig } from '../LocaleConfig';
import type { CustomMapping } from '../types';

describe('LocaleConfig', () => {
  it('refreshes its prepared locale scope after the configured locales mutate', () => {
    const locales = ['en-US', 'fr-FR'];
    const config = new LocaleConfig({ locales });

    expect(config.determineLocale('fr-FR')).toBe('fr-FR');
    locales.splice(1, 1, 'de-DE');

    expect(config.determineLocale('fr-FR')).toBeUndefined();
    expect(config.determineLocale('de-DE')).toBe('de-DE');
  });

  it('refreshes its prepared locale scope after a canonical mapping mutates', () => {
    const brandMapping = { code: 'fr-FR' };
    const customMapping: CustomMapping = {
      brand: brandMapping,
    };
    const config = new LocaleConfig({ locales: ['brand'], customMapping });

    expect(config.determineLocale('fr-FR')).toBe('brand');
    brandMapping.code = 'de-DE';

    expect(config.determineLocale('fr-FR')).toBeUndefined();
    expect(config.determineLocale('de-DE')).toBe('brand');
  });

  it('refreshes translation decisions after the configured locales mutate', () => {
    const locales = ['es'];
    const config = new LocaleConfig({ defaultLocale: 'en', locales });

    expect(config.requiresTranslation('es')).toBe(true);
    locales.splice(0, 1, 'fr');

    expect(config.requiresTranslation('es')).toBe(false);
    expect(config.requiresTranslation('fr')).toBe(true);
  });

  it('does not expose the prepared locale scope as enumerable state', () => {
    const config = new LocaleConfig({ locales: ['en-US'] });
    const serializedBeforeResolution = JSON.stringify(config);

    config.determineLocale('en-US');

    expect(JSON.stringify(config)).toBe(serializedBeforeResolution);
    expect(Object.keys(config)).not.toContain('resolutionScope');
  });
});
