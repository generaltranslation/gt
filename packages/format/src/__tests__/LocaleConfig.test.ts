import { describe, expect, it, vi } from 'vitest';
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

describe('determineLocale approved spelling', () => {
  it('does not restandardize the approved list on warmed spelling lookups', () => {
    const config = new LocaleConfig({
      locales: ['en-us', 'fr-fr', 'de-de', 'es-es', 'pt-br'],
    });
    expect(config.determineLocale('pt-BR')).toBe('pt-br');

    const standardize = vi.spyOn(Intl, 'getCanonicalLocales');
    try {
      for (let index = 0; index < 10; index++) {
        expect(config.determineLocale('pt-BR')).toBe('pt-br');
      }
      // Allow candidate/result normalization, but not another pass over the
      // configured list on every call (the performance regression in #2067).
      expect(standardize.mock.calls.length).toBeLessThanOrEqual(30);
    } finally {
      standardize.mockRestore();
    }
  });

  it('refreshes equivalent spellings after a mapped code changes', () => {
    const mapping = { code: 'en-gb' };
    const config = new LocaleConfig({
      locales: ['brand'],
      customMapping: { brand: mapping },
    });
    expect(config.determineLocale('en-GB')).toBe('brand');

    mapping.code = 'fr-fr';
    expect(config.determineLocale('en-GB')).toBeUndefined();
    expect(config.determineLocale('fr-FR')).toBe('brand');
  });

  it.each([
    ['en-US', ['en-us', 'fr'], 'en-us'],
    [['de', 'en-GB'], ['en-gb', 'fr'], 'en-gb'],
    ['en-GB', ['en', 'fr'], 'en'],
    ['en-GB', ['en', 'en-gb'], 'en-gb'],
    ['iw', ['iw'], 'iw'],
    ['sh', ['sh'], 'sh'],
    ['sr-Latn', ['sh'], 'sh'],
    ['cnr', ['cnr'], 'cnr'],
    ['sr-ME', ['cnr'], 'cnr'],
    ['qbr', ['qbr', 'fr'], 'qbr'],
    ['de', ['en-us', 'fr'], undefined],
    ['en', [], undefined],
  ])(
    'resolves %s to an approved identifier',
    (candidate, locales, expected) => {
      const config = new LocaleConfig({ locales });
      expect(config.determineLocale(candidate)).toBe(expected);
      expect(config.determineLocale(candidate, [...locales])).toBe(expected);
    }
  );

  it.each([
    ['en-gb', 'en-GB'],
    ['en-GB', 'en-gb'],
  ])('preserves exact configured identity for %j', (...locales) => {
    const config = new LocaleConfig({ locales });
    expect(config.determineLocale('en-gb')).toBe('en-gb');
  });

  it('uses the first equivalent approved spelling when no exact match exists', () => {
    const config = new LocaleConfig({ locales: ['EN-gb', 'en-gb'] });
    expect(config.determineLocale('en-GB')).toBe('EN-gb');
  });

  it('returns an approved alias whose mapped code has noncanonical spelling', () => {
    const config = new LocaleConfig({
      locales: ['brand', 'other'],
      customMapping: { brand: { code: 'en-gb' }, other: { code: 'en-gb' } },
    });
    expect(config.determineLocale('en-GB')).toBe('brand');
    expect(config.determineLocale('en-GB', ['other'])).toBe('other');
    expect(config.determineLocale('en-GB')).toBe('brand');
  });

  it('preserves an exact alias without changing candidate priority', () => {
    const config = new LocaleConfig({
      locales: ['en', 'brand', 'partner'],
      customMapping: { brand: { code: 'en-GB' }, partner: { code: 'en-GB' } },
    });
    expect(config.determineLocale('partner')).toBe('partner');
    expect(config.determineLocale(['de', 'partner'])).toBe('partner');
    expect(config.determineLocale(['en-AU', 'partner'])).toBe('en');
  });

  it('keeps exact mapped-code precedence over equivalent spellings', () => {
    const config = new LocaleConfig({
      locales: ['brand', 'canonical'],
      customMapping: { brand: { code: 'en-gb' }, canonical: { code: 'en-GB' } },
    });
    expect(config.determineLocale('en-GB')).toBe('canonical');
  });

  it('refreshes preserved spelling after the approved list changes', () => {
    const locales = ['en-us'];
    const config = new LocaleConfig({ locales });
    expect(config.determineLocale('en-US')).toBe('en-us');
    locales[0] = 'EN-us';
    expect(config.determineLocale('en-US')).toBe('EN-us');
  });
});
