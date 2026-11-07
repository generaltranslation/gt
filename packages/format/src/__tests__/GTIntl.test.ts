import { describe, expect, it, vi } from 'vitest';
import { GTIntl } from '../GTIntl';
import { determineLocale } from '../core';
import { intlCache } from '../cache/IntlCache';
import type { CustomMapping } from '../types';

describe('GTIntl', () => {
  it('ignores later changes to the locale configuration it was given', () => {
    const brandMapping = { code: 'fr-FR' };
    const customMapping: CustomMapping = { brand: brandMapping };
    const locales = ['en-US', 'brand', 'es'];
    const config = new GTIntl({
      defaultLocale: 'en-US',
      locales,
      customMapping,
    });

    expect(config.determineLocale('fr-FR')).toBe('brand');
    locales.splice(1, 2, 'de-DE');
    brandMapping.code = 'de-DE';
    customMapping.other = { code: 'it' };

    expect(config.determineLocale('fr-FR')).toBe('brand');
    expect(config.determineLocale('de-DE')).toBeUndefined();
    expect(config.requiresTranslation({ locale: 'es' })).toBe(true);
    expect(config.locales).toEqual(['en-US', 'brand', 'es']);
    expect(config.customMapping).toEqual({ brand: { code: 'fr-FR' } });
  });

  it('freezes the locale configuration it exposes', () => {
    const config = new GTIntl({
      locales: ['en', 'brand'],
      customMapping: { brand: { code: 'fr' } },
    });

    expect(Object.isFrozen(config.locales)).toBe(true);
    expect(Object.isFrozen(config.customMapping)).toBe(true);
    expect(Object.isFrozen(config.customMapping?.brand)).toBe(true);
    expect(() => (config.locales as string[]).push('de')).toThrow(TypeError);
    expect(() => {
      (config.customMapping!.brand as { code: string }).code = 'de';
    }).toThrow(TypeError);
    expect(config.determineLocale('fr')).toBe('brand');
  });

  it('does not expose the prepared locale scope as enumerable state', () => {
    const config = new GTIntl({ locales: ['en-US'] });
    const serializedBeforeResolution = JSON.stringify(config);

    config.determineLocale('en-US');

    expect(JSON.stringify(config)).toBe(serializedBeforeResolution);
    expect(Object.keys(config)).not.toContain('resolutionScope');
  });
});

describe('determineLocale approved spelling', () => {
  it('does not restandardize the approved list on warmed spelling lookups', () => {
    const config = new GTIntl({
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
      const config = new GTIntl({ locales });
      expect(config.determineLocale(candidate)).toBe(expected);
      expect(
        config.determineLocale(candidate, { approvedLocales: [...locales] })
      ).toBe(expected);
    }
  );

  it.each([
    ['en-gb', 'en-GB'],
    ['en-GB', 'en-gb'],
  ])('preserves exact configured identity for %j', (...locales) => {
    const config = new GTIntl({ locales });
    expect(config.determineLocale('en-gb')).toBe('en-gb');
  });

  it('uses the first equivalent approved spelling when no exact match exists', () => {
    const config = new GTIntl({ locales: ['EN-gb', 'en-gb'] });
    expect(config.determineLocale('en-GB')).toBe('EN-gb');
  });

  it('returns an approved alias whose mapped code has noncanonical spelling', () => {
    const config = new GTIntl({
      locales: ['brand', 'other'],
      customMapping: { brand: { code: 'en-gb' }, other: { code: 'en-gb' } },
    });
    expect(config.determineLocale('en-GB')).toBe('brand');
    expect(
      config.determineLocale('en-GB', { approvedLocales: ['other'] })
    ).toBe('other');
    expect(config.determineLocale('en-GB')).toBe('brand');
  });

  it('preserves an exact alias without changing candidate priority', () => {
    const config = new GTIntl({
      locales: ['en', 'brand', 'partner'],
      customMapping: { brand: { code: 'en-GB' }, partner: { code: 'en-GB' } },
    });
    expect(config.determineLocale('partner')).toBe('partner');
    expect(config.determineLocale(['de', 'partner'])).toBe('partner');
    expect(config.determineLocale(['en-AU', 'partner'])).toBe('en');
  });

  it('keeps exact mapped-code precedence over equivalent spellings', () => {
    const config = new GTIntl({
      locales: ['brand', 'canonical'],
      customMapping: { brand: { code: 'en-gb' }, canonical: { code: 'en-GB' } },
    });
    expect(config.determineLocale('en-GB')).toBe('canonical');
  });

  it('returns the first equivalent approved spelling for a same-script match', () => {
    expect(
      new GTIntl({ locales: ['EN-gb', 'en-GB'] }).determineLocale('en-AU')
    ).toBe('EN-gb');
  });

  it('returns the first equivalent approved alias for a same-script match', () => {
    expect(
      determineLocale('en-AU', ['brand', 'canonical'], {
        brand: { code: 'en-gb' },
        canonical: { code: 'en-GB' },
      })
    ).toBe('brand');
  });

  it.each(['lookup', 'best fit'] as const)(
    'keeps approved order when a truncation outranks an exact alias with localeMatcher=%s',
    (localeMatcher) => {
      const config = new GTIntl({
        locales: ['brand', 'partner'],
        customMapping: { brand: { code: 'en' }, partner: { code: 'en' } },
        localeMatcher,
      });
      expect(config.determineLocale(['en-US', 'partner'])).toBe('brand');
    }
  );
});

describe('determineLocale locale matching', () => {
  const brandMapping: CustomMapping = { 'brand-fr': { code: 'fr-FR' } };

  it.each<[string | string[], string[], string | undefined, CustomMapping?]>([
    ['en', ['en-GB', 'fr-FR'], 'en-GB'],
    [['en', 'fr'], ['en-GB', 'fr-FR'], 'en-GB'],
    ['en-AU', ['en-GB'], 'en-GB'],
    [['en-AU', 'en-GB'], ['en-US', 'en-GB'], 'en-GB'],
    [['fr-CA', 'fr', 'en-US', 'en'], ['en-US', 'fr-FR'], 'fr-FR'],
    [['fr-CA', 'en-GB'], ['fr-FR', 'en-GB'], 'fr-FR'],
    [['de-AT', 'en'], ['en', 'de-DE'], 'de-DE'],
    ['fr-CA', ['fr-FR'], 'fr-FR'],
    ['es-MX', ['es-ES', 'es-419'], 'es-ES'],
    ['en', ['en-GB', 'en-US'], 'en-GB'],
    ['zh-HK', ['zh-CN', 'zh-TW'], 'zh-TW'],
    ['zh-TW', ['zh-CN', 'en'], undefined],
    ['zh-TW', ['zh', 'en'], 'zh'],
    ['sr-Latn', ['sr-Cyrl'], undefined],
    ['pa-PK', ['pa-IN', 'en'], undefined],
    ['uz-Cyrl', ['uz', 'en'], 'uz'],
    ['en-US', ['en'], 'en'],
    ['ja', ['en', 'fr'], undefined],
    ['iw', ['he'], 'he'],
    ['brand-fr', ['en-US', 'brand-fr'], 'brand-fr', brandMapping],
    ['fr-FR', ['en-US', 'brand-fr'], 'brand-fr', brandMapping],
    ['fr-CA', ['en-US', 'brand-fr'], 'brand-fr', brandMapping],
    ['en-gb', ['en-gb'], 'en-gb'],
    ['zh-Hant-CN-x-private1-private2', ['zh-Hant', 'zh'], 'zh-Hant'],
  ])(
    'best fit resolves %j against %j to %s',
    (requested, locales, expected, customMapping) => {
      expect(
        new GTIntl({ locales, customMapping }).determineLocale(requested)
      ).toBe(expected);
      expect(determineLocale(requested, locales, customMapping)).toBe(expected);
    }
  );

  it.each<[string | string[], string[], string | undefined]>([
    ['en', ['en-GB'], undefined],
    ['fr-CA', ['fr-FR'], undefined],
    [['en-AU', 'en-GB'], ['en-US', 'en-GB'], 'en-GB'],
    ['en-US', ['en'], 'en'],
    [['*', 'fr'], ['en', 'fr'], 'fr'],
  ])('lookup resolves %j against %j to %s', (requested, locales, expected) => {
    const config = new GTIntl({ locales, localeMatcher: 'lookup' });
    expect(config.determineLocale(requested)).toBe(expected);
  });
});

describe('requested locale caching', () => {
  it('does not grow the Intl cache with distinct requested tags', () => {
    const intl = new GTIntl({ locales: ['en', 'fr'] });
    const cacheSize = () =>
      Object.values(intlCache['cache']).reduce(
        (size, entries) => size + Object.keys(entries ?? {}).length,
        0
      );
    // Warm the fixed language and region DisplayNames entries.
    intl.determineLocale('en-US');
    const sizeBefore = cacheSize();
    for (let i = 0; i < 100; i++) {
      const requested = `en-${String(i).padStart(3, '0')}`;
      intl.isValidLocale(requested);
      intl.determineLocale(requested);
    }
    expect(cacheSize()).toBe(sizeBefore);
  });
});

describe('GTIntl locale option', () => {
  const intl = new GTIntl(
    { defaultLocale: 'en', locales: ['en', 'es', 'fr'] },
    { locale: 'es' }
  );

  it('formats in the instance locale unless a call passes locale', () => {
    expect(intl.formatNum(1234.5)).toBe(
      new Intl.NumberFormat('es').format(1234.5)
    );
    expect(intl.formatNum(1234.5, { locale: 'fr' })).toBe(
      new Intl.NumberFormat('fr').format(1234.5)
    );
    expect(intl.formatCurrency(5, 'EUR', { locale: 'fr' })).toBe(
      new Intl.NumberFormat('fr', {
        style: 'currency',
        currency: 'EUR',
      }).format(5)
    );
    expect(intl.formatList(['a', 'b'], { locales: ['en'] })).toBe('a and b');
  });

  it('falls back to the default locale without an instance locale', () => {
    expect(new GTIntl({ defaultLocale: 'de' }).formatNum(1234.5)).toBe(
      new Intl.NumberFormat('de').format(1234.5)
    );
  });

  it('checks translation for the instance locale unless a call passes locale', () => {
    expect(intl.requiresTranslation()).toBe(true);
    expect(intl.requiresTranslation({ locale: 'en' })).toBe(false);
    expect(intl.requiresTranslation({ locale: 'es', sourceLocale: 'es' })).toBe(
      false
    );
    expect(new GTIntl({ defaultLocale: 'en' }).requiresTranslation()).toBe(
      false
    );
  });

  it.each([
    ['omitted locales: no restriction', {}, {}, true],
    ['explicit empty locales: none approved', { locales: [] }, {}, false],
    [
      'per-call empty approvedLocales: none approved',
      {},
      { approvedLocales: [] },
      false,
    ],
  ])('requiresTranslation with %s', (_label, config, options, expected) => {
    expect(
      new GTIntl(
        { defaultLocale: 'en', ...config },
        { locale: 'es' }
      ).requiresTranslation(options)
    ).toBe(expected);
  });

  it('names regions in the target locale and reads customMapping region entries', () => {
    const branded = new GTIntl({
      customMapping: {
        'brand-fr': {
          code: 'fr-FR',
          regionCode: 'FR',
          regionName: 'Brand France',
          emoji: '🥖',
        },
        'brand-fr-2': { code: 'fr-FR', regionCode: 'FR', regionName: 'Second' },
      },
    });

    expect(branded.getRegionProperties('FR')).toEqual({
      code: 'FR',
      name: 'Brand France',
      emoji: '🥖',
      locale: 'brand-fr',
    });
    expect(branded.getRegionProperties('US', { locale: 'fr' })).toEqual({
      code: 'US',
      name: new Intl.DisplayNames(['fr'], { type: 'region' }).of('US'),
      emoji: '🇺🇸',
    });
    expect(intl.getRegionProperties('US').name).toBe(
      new Intl.DisplayNames(['es'], { type: 'region' }).of('US')
    );
  });
});

describe('GTIntl locale description helpers', () => {
  const languageName = (locale: string, displayLocale: string) =>
    new Intl.DisplayNames([displayLocale], { type: 'language' }).of(locale);
  const regionName = (region: string, displayLocale: string) =>
    new Intl.DisplayNames([displayLocale], { type: 'region' }).of(region);
  const intl = new GTIntl(
    {
      defaultLocale: 'en',
      customMapping: { 'brand-ar': { code: 'ar' }, 'brand-de': { code: 'de' } },
    },
    { locale: 'brand-ar' }
  );

  it.each([
    ['getLocaleName()', () => intl.getLocaleName(), languageName('ar', 'ar')],
    [
      'getLocaleName(locale)',
      () => intl.getLocaleName('fr'),
      languageName('fr', 'ar'),
    ],
    [
      'getLocaleName(locale, { locale })',
      () => intl.getLocaleName('fr', { locale: 'brand-de' }),
      languageName('fr', 'de'),
    ],
    [
      'getLocaleName(undefined, { locale })',
      () => intl.getLocaleName(undefined, { locale: 'brand-de' }),
      languageName('de', 'de'),
    ],
    [
      'getLocaleProperties()',
      () => intl.getLocaleProperties().name,
      languageName('ar', 'ar'),
    ],
    [
      'getLocaleProperties(locale, { locale })',
      () => intl.getLocaleProperties('fr', { locale: 'brand-de' }).name,
      languageName('fr', 'de'),
    ],
    [
      'getLocaleProperties(undefined, { locale })',
      () => intl.getLocaleProperties(undefined, { locale: 'brand-de' }).name,
      languageName('de', 'de'),
    ],
    ['getLocaleDirection()', () => intl.getLocaleDirection(), 'rtl'],
    ['getLocaleDirection(locale)', () => intl.getLocaleDirection('en'), 'ltr'],
    [
      'getLocaleDirection(undefined, { locale })',
      () => intl.getLocaleDirection(undefined, { locale: 'brand-de' }),
      'ltr',
    ],
    [
      'getLocaleEmoji()',
      () => intl.getLocaleEmoji(),
      new GTIntl().getLocaleEmoji('ar'),
    ],
    [
      'getLocaleEmoji(undefined, { locale })',
      () => intl.getLocaleEmoji(undefined, { locale: 'brand-de' }),
      '🇩🇪',
    ],
    [
      'getRegionProperties(region)',
      () => intl.getRegionProperties('US').name,
      regionName('US', 'ar'),
    ],
    [
      'getRegionProperties(region, { locale })',
      () => intl.getRegionProperties('US', { locale: 'brand-de' }).name,
      regionName('US', 'de'),
    ],
  ])('%s describes and names in the target locale', (_label, run, expected) => {
    expect(run()).toBe(expected);
  });

  it('names locales in the default locale without an instance locale', () => {
    expect(new GTIntl({ defaultLocale: 'fr' }).getLocaleName('de')).toBe(
      languageName('de', 'fr')
    );
    expect(new GTIntl().getLocaleName()).toBe(languageName('en', 'en'));
  });

  it('standardizes spelling without resolving aliases', () => {
    expect(intl.standardizeLocale('brand-ar')).toBe('brand-AR');
    expect(intl.resolveCanonicalLocale('brand-ar')).toBe('ar');
  });
});
