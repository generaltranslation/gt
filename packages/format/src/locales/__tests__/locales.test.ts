import { afterEach, describe, expect, it, vi } from 'vitest';
import { intlCache } from '../../cache/IntlCache';
import { getRegionProperties } from '../../core';
import type { CustomMapping } from '../customLocaleMapping';
import { _determineLocale, findMatchingCode } from '../determineLocale';
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
      const localeLookups = () =>
        get.mock.calls.filter(
          ([constructor, locale]) =>
            constructor === 'Locale' && locale === 'pt-PT'
        ).length;
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(localeLookups()).toBeLessThanOrEqual(1);

      const lookupsBeforeFlood = localeLookups();
      for (let index = 0; index < 1000; index++) {
        expect(_isValidLocale(`zz-${index}`)).toBe(false);
      }
      expect(_isValidLocale('pt-PT')).toBe(true);
      expect(localeLookups()).toBe(lookupsBeforeFlood + 1);
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

describe('_determineLocale', () => {
  it.each<[string, string | string[], string[], string | undefined]>([
    ['an exact match', ['en-US', 'fr-FR'], ['en-US', 'es-ES'], 'en-US'],
    ['a single locale string', 'en-US', ['en-US', 'es-ES'], 'en-US'],
    [
      'the first preferred locale over approved order',
      ['en-US', 'fr-FR', 'de-DE'],
      ['fr-FR', 'en-US', 'de-DE'],
      'en-US',
    ],
    [
      'an earlier preference matched by language over a later exact match',
      ['fr-CA', 'en-US'],
      ['en-US', 'fr-FR'],
      'fr-FR',
    ],
    ['a noncanonical spelling', ['en-us'], ['en-US'], 'en-US'],
    ['the most likely region of the language', ['fr-CA'], ['fr-FR'], 'fr-FR'],
    [
      'the most likely region among several dialects',
      ['en-AU'],
      ['en-US', 'en-GB', 'fr-FR'],
      'en-US',
    ],
    ['the minimized locale', ['de-DE'], ['de', 'en-US'], 'de'],
    ['the bare language', ['es-MX'], ['es', 'en-US'], 'es'],
    [
      'the bare language before other dialects',
      ['pt-BR'],
      ['pt-PT', 'pt', 'en-US'],
      'pt',
    ],
    [
      'the bare language before another script',
      ['sr-Latn'],
      ['sr-Cyrl', 'sr', 'en-US'],
      'sr',
    ],
    [
      'a language-script candidate',
      ['zh-Hans-SG'],
      ['zh-Hans', 'zh', 'en-SG'],
      'zh-Hans',
    ],
    [
      'no arbitrary dialect of the same language',
      ['en-AU'],
      ['en-GB', 'en-CA', 'fr-FR'],
      undefined,
    ],
    [
      'no script-region candidate from a script-only locale',
      ['zh-Hans'],
      ['zh-Hans-CN', 'zh-Hant-TW', 'en-US'],
      undefined,
    ],
    [
      'no candidate with a different region or script',
      ['zh-Hans-HK'],
      ['zh-Hans-CN', 'zh-Hant-TW', 'zh-Hant-HK'],
      undefined,
    ],
    ['no other language', ['ja-JP'], ['en-US', 'ko-KR', 'zh-CN'], undefined],
    [
      'a valid locale after invalid ones',
      ['invalid-locale', 'en-US', 'another-invalid'],
      ['en-US', 'fr-FR'],
      'en-US',
    ],
    [
      'a valid approved locale among invalid ones',
      ['en-US'],
      ['invalid-approved', 'en-US', 'another-invalid'],
      'en-US',
    ],
    ['nothing without candidates', [], ['en-US'], undefined],
    ['nothing without approved locales', ['en-US'], [], undefined],
  ])('resolves %s', (_label, locales, approvedLocales, expected) => {
    expect(_determineLocale(locales, approvedLocales)).toBe(expected);
  });

  it.each<[string, string[], string[], string | undefined]>([
    [
      'an approved alias',
      ['custom-locale', 'alias-locale'],
      ['custom-locale', 'en-US'],
      'custom-locale',
    ],
    // _determineLocale returns the standardized alias; LocaleConfig restores
    // the approved spelling.
    [
      'the standardized spelling of an approved alias',
      ['custom-en', 'fr-FR'],
      ['custom-en', 'de-DE'],
      'custom-EN',
    ],
    [
      'no canonical code for an alias that is not approved',
      ['alias-locale'],
      ['en-US', 'fr-FR'],
      undefined,
    ],
    [
      'nothing for an approved name-only mapping',
      ['en-US'],
      ['name-only', 'fr-FR'],
      undefined,
    ],
  ])(
    'resolves %s with a custom mapping',
    (_label, locales, approvedLocales, expected) => {
      const customMapping: CustomMapping = {
        'custom-locale': { code: 'fr-FR', name: 'Custom Language' },
        'alias-locale': { code: 'en-US', name: 'Aliased American English' },
        'custom-en': { code: 'en-US', name: 'Custom English' },
        'name-only': { name: 'Custom Approved Language' },
      };
      expect(_determineLocale(locales, approvedLocales, customMapping)).toBe(
        expected
      );
    }
  );
});

describe('findMatchingCode', () => {
  it.each<[string, string, string[], string | undefined]>([
    // exact matches
    ['an exact locale', 'en-US', ['en-US'], 'en-US'],
    ['an exact bare language', 'pt', ['pt', 'pt-BR'], 'pt'],
    [
      'an exact match over every derived match',
      'zh-Hans-HK',
      ['zh-Hans', 'zh-HK', 'zh-Hans-HK'],
      'zh-Hans-HK',
    ],
    ['an exact variant', 'sl-rozaj', ['sl-rozaj'], 'sl-rozaj'],
    // derived matches
    ['a language-region candidate', 'zh-Hans-HK', ['zh-HK'], 'zh-HK'],
    ['a language-script candidate', 'zh-Hant-TW', ['zh-Hant'], 'zh-Hant'],
    ['a region inferred from the script', 'zh-Hant', ['zh-TW'], 'zh-TW'],
    ['a script inferred from the region', 'zh-TW', ['zh-Hant'], 'zh-Hant'],
    ['a numeric region subtag', 'es-Latn-419', ['es-419'], 'es-419'],
    ['the likely region of a bare language', 'pt', ['pt-BR'], 'pt-BR'],
    ['the likely script of a bare language', 'sr', ['sr-Cyrl'], 'sr-Cyrl'],
    ['the minimized locale', 'en-Latn-US', ['en'], 'en'],
    [
      'the minimized locale with its Unicode extension',
      'en-Latn-US-u-ca-buddhist',
      ['en-u-ca-buddhist'],
      'en-u-ca-buddhist',
    ],
    [
      'a candidate derived from a locale with a variant',
      'sl-Latn-SI-rozaj',
      ['sl-SI'],
      'sl-SI',
    ],
    // precedence
    ['a region over a script', 'zh-Hans-HK', ['zh-Hans', 'zh-HK'], 'zh-HK'],
    [
      'a region over a script regardless of insertion order',
      'zh-Hans-HK',
      ['zh-HK', 'zh-Hans'],
      'zh-HK',
    ],
    [
      'a script over the minimized locale',
      'en-Latn-US-u-ca-buddhist',
      ['en-u-ca-buddhist', 'en-Latn'],
      'en-Latn',
    ],
    [
      'a likely region over a likely script',
      'sr',
      ['sr-Cyrl', 'sr-RS'],
      'sr-RS',
    ],
    // no match
    ['nothing in an empty candidate set', 'en-US', [], undefined],
    ['no arbitrary dialect of the language', 'en-AU', ['en-GB'], undefined],
    ['no prefix or partial match', 'en-US', ['en-U', 'en-US-extra'], undefined],
    ['no unrelated language', 'en-US', ['fr-FR'], undefined],
  ])('matches %s', (_label, locale, candidates, expected) => {
    expect(findMatchingCode(locale, new Set(candidates))).toBe(expected);
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
      locales.filter((locale) => _getLocaleDirection(locale) !== direction)
    ).toEqual([]);
  });

  it('prefers Intl.Locale textInfo over script and language heuristics', () => {
    const locale = {
      textInfo: { direction: 'ltr' },
      language: 'ar',
      maximize: vi.fn(() => ({ script: 'Arab' })),
    } as unknown as Intl.Locale;
    vi.spyOn(intlCache, 'get').mockReturnValue(locale);

    expect(_getLocaleDirection('ar-Arab')).toBe('ltr');
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

    expect(_getLocaleDirection(code)).toBe(expected);
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

      expect(_getLocaleDirection(code)).toBe(expected);
    }
  );
});

describe('_getLocaleName', () => {
  it.each<[string, string | undefined, string]>([
    ['en-US', 'en', 'American English'],
    ['fr-FR', 'en', 'French (France)'],
    ['fr', 'en', 'French'],
    ['ja', 'en', 'Japanese'],
    ['zh-Hans-CN', 'en', 'Chinese (Simplified, China)'],
    // display locale
    ['fr-FR', 'fr', 'français (France)'],
    ['ja-JP', 'de', 'Japanisch (Japan)'],
    ['fr-FR', undefined, 'French (France)'],
    ['en-US', 'invalid-display-locale', 'American English'],
    // unknown and malformed input
    ['xyz', 'en', 'xyz'],
    ['', 'en', ''],
    ['123-456', 'en', ''],
    ['en-US', 'not a locale', ''],
  ])('names %j in %j as %j', (locale, displayLocale, expected) => {
    expect(_getLocaleName(locale, displayLocale)).toBe(expected);
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
    expect(_getLocaleName(locale, undefined, customMapping)).toBe(expected);
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
    expect(_getLocaleProperties('en-US')).toEqual({
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
    expect(_getLocaleProperties('en')).toMatchObject({
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
    expect(_getLocaleProperties('zh-Hans-CN')).toMatchObject({
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
    expect(_getLocaleProperties('invalid-locale-xyz')).toEqual({
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
    expect(_getLocaleProperties(locale)).toMatchObject(expected);
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
