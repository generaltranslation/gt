import { afterEach, describe, expect, it, vi } from 'vitest';
import { intlCache } from '../../cache/IntlCache';
import { getLocaleName } from '../../core';
import { defaultDefaultLocale } from '../../settings/settings';
import type { CustomMapping } from '../customLocaleMapping';
import { _determineLocale, type MatchLocale } from '../determineLocale';
import { _getLocaleDirection } from '../getLocaleDirection';
import {
  _getLocaleEmoji,
  defaultEmoji,
  getRegionEmoji,
} from '../getLocaleEmoji';
import { _getLocaleName } from '../getLocaleName';
import {
  _getLocaleProperties,
  createCustomLocaleProperties,
} from '../getLocaleProperties';
import { getRegionProperties } from '../getRegionProperties';
import { _isValidLocale, _standardizeLocale } from '../isValidLocale';
import { _resolveAliasLocale } from '../resolveAliasLocale';

describe('_isValidLocale', () => {
  it('accepts well-formed locales', () => {
    const locales = [
      // language, language-region
      'en',
      'en-US',
      'fr-CA',
      'de-AT',
      'es-MX',
      'ja-JP',
      'zh-TW',
      'ar-SA',
      // language-script, language-script-region
      'zh-Hans',
      'zh-Hans-CN',
      'zh-Hant-TW',
      'sr-Latn',
      'sr-Cyrl-RS',
      'uz-Latn-UZ',
      'ko-Jamo',
      'th-Thai',
      // BCP 47 tags are case-insensitive
      'EN-us',
      'Fr-ca',
      // private-use language range (qaa-qtz)
      'qaa',
      'qbb',
      'qtz',
    ];
    expect(locales.filter((locale) => !_isValidLocale(locale))).toEqual([]);
  });

  it('rejects unknown and malformed locales', () => {
    const locales = [
      'invalid',
      'xyz',
      'abc123',
      'toolong-invalid-locale-code',
      '123',
      '',
      'root',
      'und',
      // unknown region or language
      'en-INVALID',
      'fr-NOTREAL',
      'invalid-US',
      // malformed structure
      'en-US-EXTRA-PARTS',
      'en-',
      '-en',
      'en--US',
      'en-123-US',
    ];
    expect(locales.filter((locale) => _isValidLocale(locale))).toEqual([]);
  });

  it.each([
    ['an alias with a valid canonical code', 'alias', true],
    ['an invalid-looking alias with a valid canonical code', 'xyz-123', true],
    ['a name-only object mapping', 'name-only', false],
    ['a string mapping', 'string-name', false],
    ['an empty canonical code', 'empty-code', false],
    ['a mapped standard locale', 'en-US', true],
    ['an unmapped standard locale', 'fr-FR', true],
    ['an unmapped invalid locale', 'still-invalid', false],
  ])('validates %s through the custom mapping', (_label, locale, expected) => {
    const customMapping: CustomMapping = {
      alias: { code: 'en-US', name: 'Aliased American English' },
      'xyz-123': { code: 'fr-FR', name: 'XYZ Language', emoji: '🎯' },
      'name-only': { name: 'Custom Invalid Locale' },
      'string-name': 'Made Up Language',
      'empty-code': { code: '', name: 'Test Name' },
      'en-US': { name: 'Custom American English' },
    };
    expect(_isValidLocale(locale, customMapping)).toBe(expected);
  });

  it('reuses validation results without growing past its cap', () => {
    const get = vi.spyOn(intlCache, 'get');
    try {
      const validations = () =>
        get.mock.calls.filter(
          ([constructor, , options]) =>
            constructor === 'DisplayNames' &&
            (options as Intl.DisplayNamesOptions).type === 'region'
        ).length;
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(validations()).toBeLessThanOrEqual(1);

      const lookupsBeforeFlood = validations();
      for (let index = 0; index < 1000; index++) {
        expect(_isValidLocale(`zz-${index}`)).toBe(false);
      }
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(validations()).toBe(lookupsBeforeFlood + 1);
    } finally {
      get.mockRestore();
    }
  });
});

describe('_standardizeLocale', () => {
  it.each([
    ['en-us', 'en-US'],
    ['EN-US', 'en-US'],
    ['fr-ca', 'fr-CA'],
    ['ZH-HANS-CN', 'zh-Hans-CN'],
    ['sr-latn-rs', 'sr-Latn-RS'],
    ['QAA', 'qaa'],
    // already canonical
    ['de', 'de'],
    ['zh-Hans-CN', 'zh-Hans-CN'],
    ['root', 'root'],
    ['und', 'und'],
    // unknown but structurally valid tags pass through
    ['xyz', 'xyz'],
    ['invalid-locale', 'invalid-locale'],
    // structurally invalid tags are returned unchanged
    ['', ''],
    ['en_US', 'en_US'],
  ])('standardizes %j to %j', (locale, expected) => {
    expect(_standardizeLocale(locale)).toBe(expected);
  });
});

const matchLocale = (tag: string, script = ''): MatchLocale => ({
  tag,
  language: tag.split('-')[0],
  script,
});

const tags = (...values: string[]) => values.map((tag) => matchLocale(tag));

describe('_determineLocale', () => {
  it.each([
    ['zh-Hant-CN-x-private1-private2', 'zh-Hant-CN-x-private1'],
    ['zh-Hant-CN-x-private1', 'zh-Hant-CN'],
    ['zh-Hant-CN', 'zh-Hant'],
    ['zh-Hant', 'zh'],
  ])('lookup truncates %s to %s', (requested, available) => {
    expect(
      _determineLocale(tags(requested), tags(available), 'lookup')?.available
        .tag
    ).toBe(available);
  });

  it('removes a single-character subtag together with its trailing subtag', () => {
    expect(
      _determineLocale(
        tags('zh-Hant-CN-x-private1'),
        tags('zh-Hant-CN-x'),
        'lookup'
      )
    ).toBeUndefined();
  });

  it('tries every truncation of a range before the next range', () => {
    expect(
      _determineLocale(tags('en-GB', 'fr'), tags('fr', 'en'), 'lookup')
        ?.available.tag
    ).toBe('en');
  });

  it('matches tags without a derivable script as empty scripts in best fit', () => {
    expect(
      _determineLocale(tags('qaa-QM'), tags('qaa-QN'), 'best fit')?.available
        .tag
    ).toBe('qaa-QN');
    expect(
      _determineLocale(tags('qaa-QM'), tags('qaa-QN'), 'lookup')
    ).toBeUndefined();
  });

  it('reports the requested record that produced the match', () => {
    const requested = tags('de', 'fr-CA-x-test');
    const available = tags('fr-CA');
    const match = _determineLocale(requested, available, 'lookup');
    expect(match?.requested).toBe(requested[1]);
    expect(match?.available).toBe(available[0]);
  });
});

describe('_resolveAliasLocale', () => {
  const customMapping: CustomMapping = {
    'string-only': 'Just a string',
    'no-code': { name: 'No Code Property' },
    // @ts-expect-error testing malformed runtime input
    'null-value': null,
    // @ts-expect-error testing malformed runtime input
    'undefined-value': undefined,
    // @ts-expect-error testing malformed runtime input
    'numeric-code': { code: 42, name: 'Mixed Types' },
    'empty-code': { code: '', name: 'Empty Code' },
    'alias-en': { code: 'en-US', name: 'First English Alias' },
    'alias-en-2': { code: 'en-US', name: 'Second English Alias' },
    'alias-fr': { code: 'fr-FR', name: 'French Alias' },
  };

  it.each([
    ['the first alias of a canonical code', 'en-US', 'alias-en'],
    ['the alias of another canonical code', 'fr-FR', 'alias-fr'],
    ['an unmapped locale', 'es-ES', 'es-ES'],
    ['a canonical code with different casing', 'en-us', 'en-us'],
    ['a string-only entry', 'string-only', 'string-only'],
    ['an entry without a code', 'no-code', 'no-code'],
    ['a null entry', 'null-value', 'null-value'],
    ['an undefined entry', 'undefined-value', 'undefined-value'],
    ['an entry with a non-string code', 'numeric-code', 'numeric-code'],
    ['an alias itself', 'alias-en', 'alias-en'],
    ['an empty locale to the alias with an empty code', '', 'empty-code'],
  ])('resolves %s', (_label, locale, expected) => {
    expect(_resolveAliasLocale(locale, customMapping)).toBe(expected);
  });

  it('returns the locale unchanged without a usable mapping', () => {
    expect(_resolveAliasLocale('en-US')).toBe('en-US');
    expect(_resolveAliasLocale('en-US', {})).toBe('en-US');
  });
});

describe('_getLocaleDirection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      'ltr',
      ['en', 'en-US', 'fr-CA', 'ja-JP', 'zh-Hans-CN', 'en-Latn-US', 'EN-us'],
    ],
    ['rtl', ['ar', 'ar-EG', 'he-IL', 'fa-IR', 'ur-PK', 'ar-Arab-SA', 'AR-sa']],
    ['ltr', ['invalid', 'xyz-123', '', 'not-a-locale', '123', 'root', 'und']],
  ] as const)('returns %s for %j', (direction, locales) => {
    expect(
      locales.filter(
        (locale) =>
          _getLocaleDirection(locale, defaultDefaultLocale) !== direction
      )
    ).toEqual([]);
  });

  it('prefers Intl.Locale textInfo over script and language heuristics', () => {
    const locale = {
      textInfo: { direction: 'ltr' },
      language: 'ar',
      maximize: vi.fn(() => ({ script: 'Arab' })),
    } as unknown as Intl.Locale;
    vi.spyOn(intlCache, 'get').mockReturnValue(locale);

    expect(_getLocaleDirection('ar-Arab', defaultDefaultLocale)).toBe('ltr');
    expect(locale.maximize).not.toHaveBeenCalled();
  });

  // Browsers without Intl.Locale textInfo support fall back to the script.
  // jsdom and happy-dom inherit Node's Intl, so textInfo is stripped by hand.
  it.each([
    ['az-Arab', 'rtl'],
    ['az-Latn', 'ltr'],
  ])('uses the script of %s when textInfo is unavailable', (code, expected) => {
    const originalGet = intlCache.get.bind(intlCache);
    vi.spyOn(intlCache, 'get').mockImplementation(
      (...args: Parameters<typeof intlCache.get>) => {
        if (args[0] !== 'Locale') return originalGet(...args);
        const locale = new Intl.Locale(args[1] as string);
        Object.defineProperty(locale, 'textInfo', { value: undefined });
        return locale as ReturnType<typeof intlCache.get>;
      }
    );

    expect(_getLocaleDirection(code, defaultDefaultLocale)).toBe(expected);
  });

  it.each([
    ['ar', 'rtl'],
    ['en', 'ltr'],
  ])(
    'uses the language of %s when Intl.Locale is unavailable',
    (code, expected) => {
      vi.spyOn(intlCache, 'get').mockImplementation(() => {
        throw new Error('Intl.Locale not supported');
      });

      expect(_getLocaleDirection(code, defaultDefaultLocale)).toBe(expected);
    }
  );
});

describe('_getLocaleName', () => {
  it.each<[string, string, string]>([
    ['en-US', 'en', 'American English'],
    ['fr-FR', 'en', 'French (France)'],
    ['fr', 'en', 'French'],
    ['ja', 'en', 'Japanese'],
    ['zh-Hans-CN', 'en', 'Chinese (Simplified, China)'],
    // display locale
    ['fr-FR', 'fr', 'français (France)'],
    ['ja-JP', 'de', 'Japanisch (Japan)'],
    ['en-US', 'invalid-display-locale', 'American English'],
    // unknown and malformed input
    ['xyz', 'en', 'xyz'],
    ['', 'en', ''],
    ['123-456', 'en', ''],
    ['en-US', 'not a locale', ''],
  ])('names %j in %j as %j', (locale, displayLocale, expected) => {
    expect(_getLocaleName(locale, displayLocale)).toBe(expected);
  });

  it('names in the library default locale through the public helper', () => {
    expect(getLocaleName('fr-FR')).toBe('French (France)');
  });

  it.each<[string, string, string]>([
    ['the exact entry', 'en-US-custom', 'Custom US English'],
    ['the standardized entry', 'en-us', 'American English Override'],
    ['the language entry', 'en-GB', 'English Language Override'],
    ['a string entry for the language', 'es-ES', 'Custom Spanish'],
    ['the name of an alias', 'alias-locale', 'Aliased American English'],
    ['the canonical code of a nameless alias', 'fr-TEST', 'French'],
  ])('uses %s of the custom mapping', (_label, locale, expected) => {
    const customMapping: CustomMapping = {
      'en-US-custom': { name: 'Custom US English' },
      'en-US': { name: 'American English Override' },
      en: { name: 'English Language Override' },
      es: 'Custom Spanish',
      'alias-locale': { code: 'en-US', name: 'Aliased American English' },
      'fr-TEST': { code: 'fr' },
    };
    expect(_getLocaleName(locale, defaultDefaultLocale, customMapping)).toBe(
      expected
    );
  });
});

describe('getRegionEmoji', () => {
  it.each([
    ['US', '🇺🇸'],
    ['GB', '🇬🇧'],
    ['FR', '🇫🇷'],
    ['JP', '🇯🇵'],
    ['BR', '🇧🇷'],
    ['ZA', '🇿🇦'],
    ['TW', '🇹🇼'],
    // special non-alpha-2 regions
    ['EU', '🇪🇺'],
    ['419', '🌎'],
    // unsupported regions
    ['001', defaultEmoji],
    ['', defaultEmoji],
    ['AA', defaultEmoji],
    ['QM', defaultEmoji],
    ['QQ', defaultEmoji],
    ['XA', defaultEmoji],
    ['XB', defaultEmoji],
    ['ZZ', defaultEmoji],
  ])('maps region %j to %s', (region, emoji) => {
    expect(getRegionEmoji(region)).toBe(emoji);
  });
});

describe('_getLocaleEmoji', () => {
  it.each([
    // explicit region, with and without a script
    ['en-US', '🇺🇸'],
    ['fr-CA', '🇨🇦'],
    ['zh-Hans-CN', '🇨🇳'],
    ['zh-Hant-TW', '🇹🇼'],
    ['sr-Latn-RS', '🇷🇸'],
    // most likely region of a bare language
    ['en', '🇺🇸'],
    ['fr', '🇫🇷'],
    ['de', '🇩🇪'],
    // language exceptions
    ['ca', '🌍'],
    ['eu', '🌍'],
    ['ku', '🌍'],
    ['bo', '🌏'],
    ['ug', '🌏'],
    ['gd', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'],
    ['cy', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'],
    ['gv', '🇮🇲'],
    ['grc', '🏺'],
    // an explicit region wins over a language exception
    ['ku-TR', '🇹🇷'],
    ['eu-ES', '🇪🇸'],
    ['gv-IM', '🇮🇲'],
    ['grc-GR', '🇬🇷'],
    // an unsupported region falls back to the language exception
    ['bo-001', '🌏'],
    ['gd-001', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'],
    ['grc-001', '🏺'],
    // unsupported regions and invalid locales
    ['en-AA', defaultEmoji],
    ['en-QM', defaultEmoji],
    ['en-QQ', defaultEmoji],
    ['en-XA', defaultEmoji],
    ['en-XB', defaultEmoji],
    ['xyz', defaultEmoji],
    ['', defaultEmoji],
    ['really-invalid-123456', defaultEmoji],
  ])('maps %j to %s', (locale, emoji) => {
    expect(_getLocaleEmoji(locale)).toBe(emoji);
  });

  it.each([
    ['the exact entry', 'en-US-custom', '🎯'],
    ['the standardized entry', 'en-us', '🎪'],
    ['the language entry', 'en-GB', '🌟'],
    ['the alias entry before its canonical code', 'zh-alias', '🎲'],
    ['the canonical code of an alias without an emoji', 'zh-TEST', '🇨🇳'],
    ['the region when the entry is a string', 'fr-FR', '🇫🇷'],
    ['the region when the entry has no emoji', 'de-DE', '🇩🇪'],
  ])('uses %s of the custom mapping', (_label, locale, emoji) => {
    const customMapping: CustomMapping = {
      'en-US-custom': { emoji: '🎯' },
      'en-US': { emoji: '🎪' },
      en: { emoji: '🌟' },
      'zh-alias': { code: 'zh', emoji: '🎲' },
      'zh-TEST': { code: 'zh' },
      fr: '🎪',
      'de-DE': { name: 'German' },
    };
    expect(_getLocaleEmoji(locale, customMapping)).toBe(emoji);
  });
});

describe('createCustomLocaleProperties', () => {
  it('returns undefined without a custom mapping', () => {
    expect(createCustomLocaleProperties(['en-US', 'en'], undefined)).toBe(
      undefined
    );
  });

  it('returns an empty object when no locale is mapped', () => {
    expect(
      createCustomLocaleProperties(['en-US', 'en'], { 'fr-FR': 'French' })
    ).toEqual({});
  });

  it('uses the first string mapping as the name', () => {
    expect(
      createCustomLocaleProperties(['en-US', 'en'], {
        'en-US': 'American English',
        en: 'English',
      })
    ).toEqual({ name: 'American English' });
  });

  it('merges object mappings with earlier locales taking priority', () => {
    expect(
      createCustomLocaleProperties(['en-US', 'en'], {
        'en-US': { name: 'American English', emoji: '🇺🇸' },
        en: { name: 'English', languageName: 'English Language' },
      })
    ).toEqual({
      name: 'American English',
      emoji: '🇺🇸',
      languageName: 'English Language',
    });
  });
});

describe('_getLocaleProperties', () => {
  it('returns every property for a locale with a region', () => {
    expect(_getLocaleProperties('en-US', defaultDefaultLocale)).toEqual({
      code: 'en-US',
      name: 'American English',
      nativeName: 'American English',
      languageCode: 'en',
      languageName: 'English',
      nativeLanguageName: 'English',
      nameWithRegionCode: 'English (US)',
      nativeNameWithRegionCode: 'English (US)',
      regionCode: 'US',
      regionName: 'United States',
      nativeRegionName: 'United States',
      scriptCode: 'Latn',
      scriptName: 'Latin',
      nativeScriptName: 'Latin',
      maximizedCode: 'en-Latn-US',
      maximizedName: 'English (Latin, United States)',
      nativeMaximizedName: 'English (Latin, United States)',
      minimizedCode: 'en',
      minimizedName: 'English',
      nativeMinimizedName: 'English',
      emoji: '🇺🇸',
    });
  });

  it('infers the region and script of a bare language', () => {
    expect(_getLocaleProperties('en', defaultDefaultLocale)).toMatchObject({
      code: 'en',
      name: 'English',
      nameWithRegionCode: 'English',
      regionCode: 'US',
      scriptCode: 'Latn',
      maximizedCode: 'en-Latn-US',
      minimizedCode: 'en',
      emoji: '🇺🇸',
    });
  });

  it('keeps an explicit script and region', () => {
    expect(
      _getLocaleProperties('zh-Hans-CN', defaultDefaultLocale)
    ).toMatchObject({
      code: 'zh-Hans-CN',
      languageCode: 'zh',
      scriptCode: 'Hans',
      regionCode: 'CN',
      maximizedCode: 'zh-Hans-CN',
      minimizedCode: 'zh',
      nameWithRegionCode: 'Chinese (CN)',
    });
  });

  it('names properties in the default locale and natively', () => {
    expect(_getLocaleProperties('de', 'fr-FR')).toMatchObject({
      code: 'de',
      name: 'allemand',
      nativeName: 'Deutsch',
      regionName: 'Allemagne',
      nativeRegionName: 'Deutschland',
      scriptName: 'latin',
      nativeScriptName: 'Lateinisch',
    });
  });

  it('applies custom names, region-code names, and emoji', () => {
    const customMapping: CustomMapping = {
      'en-US': {
        name: 'Custom American English',
        nativeName: 'Custom American English Native',
        nameWithRegionCode: 'Custom English Region',
        nativeNameWithRegionCode: 'Custom Native English Region',
        emoji: '🎯',
      },
    };

    expect(_getLocaleProperties('en-US', 'en', customMapping)).toMatchObject({
      name: 'Custom American English',
      nativeName: 'Custom American English Native',
      nameWithRegionCode: 'Custom English Region',
      nativeNameWithRegionCode: 'Custom Native English Region',
      emoji: '🎯',
    });
  });

  it('resolves an alias to its canonical code and keeps its custom properties', () => {
    const customMapping: CustomMapping = {
      'alias-locale': {
        code: 'en-US',
        name: 'Aliased American English',
        emoji: '🎯',
      },
    };

    expect(
      _getLocaleProperties('alias-locale', 'en', customMapping)
    ).toMatchObject({
      code: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      name: 'Aliased American English',
      emoji: '🎯',
    });
  });

  it.each<[string, string, string]>([
    ['a string mapping', 'string-locale', 'Simple String Name'],
    ['an empty canonical code', 'empty-locale', 'Test Name'],
    ['a mapping without a code', 'another-alias', 'Another Test'],
  ])('keeps the original code for %s', (_label, locale, name) => {
    const customMapping: CustomMapping = {
      'string-locale': 'Simple String Name',
      'empty-locale': { code: '', name: 'Test Name' },
      'another-alias': { name: 'Another Test' },
    };

    expect(_getLocaleProperties(locale, 'en', customMapping)).toMatchObject({
      code: locale,
      name,
    });
  });

  it('applies custom region and script overrides to an unknown locale', () => {
    const customMapping: CustomMapping = {
      'test-locale': {
        name: 'Test Language',
        regionCode: 'XX',
        regionName: 'Test Region',
        scriptCode: 'Test',
        scriptName: 'Test Script',
      },
    };

    expect(
      _getLocaleProperties('test-locale', 'en', customMapping)
    ).toMatchObject({
      name: 'Test Language',
      regionCode: 'XX',
      regionName: 'Test Region',
      scriptCode: 'Test',
      scriptName: 'Test Script',
    });
  });

  it('falls back to the locale code for an unparseable locale', () => {
    expect(
      _getLocaleProperties('invalid-locale-xyz', defaultDefaultLocale)
    ).toEqual({
      code: 'invalid-locale-xyz',
      name: 'invalid-locale-xyz',
      nativeName: 'invalid-locale-xyz',
      languageCode: 'invalid',
      languageName: 'invalid-locale-xyz',
      nativeLanguageName: 'invalid-locale-xyz',
      nameWithRegionCode: 'invalid-locale-xyz',
      nativeNameWithRegionCode: 'invalid-locale-xyz',
      regionCode: 'xyz',
      regionName: '',
      nativeRegionName: '',
      scriptCode: '',
      scriptName: '',
      nativeScriptName: '',
      maximizedCode: 'invalid-locale-xyz',
      maximizedName: 'invalid-locale-xyz',
      nativeMaximizedName: 'invalid-locale-xyz',
      minimizedCode: 'invalid-locale-xyz',
      minimizedName: 'invalid-locale-xyz',
      nativeMinimizedName: 'invalid-locale-xyz',
      emoji: defaultEmoji,
    });
  });

  it.each([
    ['x', { code: 'x', name: 'x', languageCode: 'x', regionCode: '' }],
    ['', { code: '', name: '', languageCode: '', regionCode: '' }],
  ])('falls back for the malformed locale %j', (locale, expected) => {
    expect(_getLocaleProperties(locale, defaultDefaultLocale)).toMatchObject(
      expected
    );
  });

  it('applies custom properties on the fallback path', () => {
    const customMapping: CustomMapping = {
      'invalid-test': {
        name: 'Custom Invalid Name',
        nativeName: 'Custom Invalid Native',
        regionName: 'Custom Region',
      },
    };

    expect(
      _getLocaleProperties('invalid-test', 'en', customMapping)
    ).toMatchObject({
      name: 'Custom Invalid Name',
      nativeName: 'Custom Invalid Native',
      regionName: 'Custom Region',
    });
  });
});

describe('getRegionProperties', () => {
  it.each([
    [
      'an ISO alpha-2 region',
      ['US'],
      { code: 'US', name: 'United States', emoji: '🇺🇸' },
    ],
    [
      'the requested display locale',
      ['US', 'fr'],
      { code: 'US', name: 'États-Unis', emoji: '🇺🇸' },
    ],
    [
      'a supported UN M.49 region',
      ['419'],
      { code: '419', name: 'Latin America', emoji: '🌎' },
    ],
    [
      'an unknown region',
      ['ZZ'],
      { code: 'ZZ', name: 'Unknown Region', emoji: '🌍' },
    ],
    [
      'an invalid display locale',
      ['US', 'not a locale'],
      { code: 'US', name: 'US', emoji: '🌍' },
    ],
    [
      'a full custom mapping',
      ['US', 'en', { US: { name: 'USA', emoji: '🗽', locale: 'en-US' } }],
      { code: 'US', name: 'USA', emoji: '🗽', locale: 'en-US' },
    ],
    [
      'a partial custom mapping',
      ['US', 'en', { US: { name: 'United States of Tests' } }],
      { code: 'US', name: 'United States of Tests', emoji: '🇺🇸' },
    ],
  ] as [string, Parameters<typeof getRegionProperties>, object][])(
    'returns properties for %s',
    (_label, args, expected) => {
      expect(getRegionProperties(...args)).toEqual(expected);
    }
  );
});
