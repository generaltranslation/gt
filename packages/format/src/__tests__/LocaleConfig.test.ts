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

describe('determineLocale approved spelling', () => {
  it.each([
    ['en-US', ['en-us', 'fr'], 'en-us'],
    [['de', 'en-GB'], ['en-gb', 'fr'], 'en-gb'],
    ['en-GB', ['en', 'fr'], 'en'],
    ['en-GB', ['en', 'en-gb'], 'en-gb'],
    ['iw', ['iw'], 'iw'],
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
  ])('preserves exact canonical match precedence for %j', (...locales) => {
    const config = new LocaleConfig({ locales });
    expect(config.determineLocale('en-gb')).toBe('en-GB');
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
