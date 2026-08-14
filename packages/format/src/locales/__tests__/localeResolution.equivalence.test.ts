import { describe, it, expect } from 'vitest';
import { _determineLocale } from '../determineLocale';
import { _requiresTranslation } from '../requiresTranslation';
import { _getLocaleProperties, LocaleProperties } from '../getLocaleProperties';
import { _isSameDialect } from '../isSameDialect';
import { _isSameLanguage } from '../isSameLanguage';
import { _isValidLocale, _standardizeLocale } from '../isValidLocale';
import { CustomMapping } from '../customLocaleMapping';

// Differential tests for https://github.com/generaltranslation/gt/issues/2067.
// The implementations prepare the approved-locales list once instead of
// revalidating it per call; these references are verbatim copies of the
// per-call algorithms they replaced, so any behavior drift fails here.

function referenceRequiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[],
  customMapping?: CustomMapping
): boolean {
  const localesToValidate = [
    sourceLocale,
    targetLocale,
    ...(approvedLocales ?? []),
  ];
  if (
    localesToValidate.some((locale) => !_isValidLocale(locale, customMapping))
  ) {
    return false;
  }
  if (_isSameDialect(sourceLocale, targetLocale)) {
    return false;
  }
  if (!approvedLocales) return true;
  return approvedLocales.some((approvedLocale) =>
    _isSameLanguage(targetLocale, approvedLocale)
  );
}

function referenceGetMatchingCode(
  locale: string,
  { languageCode, minimizedCode, regionCode, scriptCode }: LocaleProperties,
  candidates: Set<string>
) {
  const localeCodes = [
    locale,
    `${languageCode}-${regionCode}`,
    `${languageCode}-${scriptCode}`,
    minimizedCode,
  ];
  return localeCodes.find((localeCode) => candidates.has(localeCode));
}

function referenceDetermineLocale(
  locales: string | string[],
  approvedLocales: string[],
  customMapping?: CustomMapping
): string | undefined {
  const standardize = (candidates: string[]) =>
    candidates
      .filter((locale) => _isValidLocale(locale, customMapping))
      .map(_standardizeLocale);
  const candidateLocales = standardize(
    Array.isArray(locales) ? locales : [locales]
  );
  approvedLocales = standardize(approvedLocales);
  for (const locale of candidateLocales) {
    const candidates = new Set(
      approvedLocales.filter((approvedLocale) =>
        _isSameLanguage(locale, approvedLocale)
      )
    );
    const properties = _getLocaleProperties(locale);
    const matchingCode =
      referenceGetMatchingCode(locale, properties, candidates) ||
      referenceGetMatchingCode(
        properties.languageCode,
        _getLocaleProperties(properties.languageCode),
        candidates
      );
    if (matchingCode) return matchingCode;
  }
  return undefined;
}

// The 55-locale config from the issue report.
const manyLocales = [
  'es',
  'zh',
  'zh-Hant',
  'hi',
  'bn',
  'ar',
  'pt-BR',
  'fr',
  'de',
  'it',
  'ru',
  'pt-PT',
  'ja',
  'ko',
  'vi',
  'th',
  'id',
  'ms',
  'fil',
  'ur',
  'ta',
  'ml',
  'gu',
  'fa',
  'tr',
  'kk',
  'mn',
  'hy',
  'ka',
  'uk',
  'pl',
  'cs',
  'sk',
  'sr',
  'hr',
  'sl',
  'mk',
  'bg',
  'lt',
  'et',
  'lv',
  'sv',
  'no',
  'da',
  'fi',
  'is',
  'nl',
  'el',
  'hu',
  'ro',
  'sq',
  'ca',
  'cy',
  'af',
];

const targetLocales = [
  ...manyLocales,
  'en',
  'en-US',
  'en-GB',
  'ar-EG',
  'fr-CA',
  'zh-CN',
  'zh-TW',
  'zh-Hans',
  'pt',
  'sr-Latn',
  'uz-Cyrl',
  'de-CH',
  'es-419',
  'nb',
  'fil-PH',
  'en-us',
  'ZH-hant',
  'qaa',
  'xx-INVALID',
  'invalid-locale',
  '',
];

const customMapping: CustomMapping = {
  'zz-mine': { code: 'fr', name: 'My French' },
  'en-lolcat': { code: 'en-GB' },
  es: 'Spanish (name only)',
};

const approvedVariants: {
  label: string;
  approved: string[];
  mapping?: CustomMapping;
}[] = [
  { label: '55 locales', approved: manyLocales },
  { label: 'small subset', approved: ['es', 'fr', 'pt'] },
  { label: 'base language only', approved: ['pt'] },
  { label: 'script dialects', approved: ['zh-Hant', 'sr-Latn'] },
  { label: 'regional dialects', approved: ['en-GB', 'fr-CA', 'pt-BR'] },
  { label: 'unstandardized codes', approved: ['en-us', 'FR', 'pt-br'] },
  { label: 'contains invalid', approved: ['es', 'xx-INVALID', 'fr'] },
  { label: 'empty', approved: [] },
  {
    label: 'custom mapping aliases',
    approved: ['zz-mine', 'en-lolcat', 'es'],
    mapping: customMapping,
  },
];

describe('_requiresTranslation matches the per-call reference', () => {
  const sources = ['en', 'en-US', 'ar', 'pt-BR', 'xx-INVALID'];
  for (const { label, approved, mapping } of approvedVariants) {
    it(`approved: ${label}`, () => {
      for (const source of sources) {
        for (const target of targetLocales) {
          const expected = referenceRequiresTranslation(
            source,
            target,
            approved,
            mapping
          );
          expect
            .soft(
              _requiresTranslation(source, target, approved, mapping),
              `source=${source} target=${target}`
            )
            .toBe(expected);
        }
      }
    });
  }

  it('approved: undefined (no restriction)', () => {
    for (const source of ['en', 'ar']) {
      for (const target of targetLocales) {
        const expected = referenceRequiresTranslation(source, target);
        expect
          .soft(
            _requiresTranslation(source, target),
            `source=${source} target=${target}`
          )
          .toBe(expected);
      }
    }
  });
});

describe('_determineLocale matches the per-call reference', () => {
  const candidateLists: (string | string[])[] = [
    ...targetLocales.map((locale) => [locale]),
    'fr-CA',
    ['ar-EG', 'ar'],
    ['ja-JP', 'en-US'],
    ['invalid-locale', 'fr-CA', 'es'],
    ['zh-Hans-CN', 'zh'],
    ['pt-PT', 'pt-BR'],
    ['xx-INVALID', ''],
    [],
    ['en-lolcat', 'zz-mine'],
  ];
  for (const { label, approved, mapping } of approvedVariants) {
    it(`approved: ${label}`, () => {
      for (const candidates of candidateLists) {
        const expected = referenceDetermineLocale(
          candidates,
          approved,
          mapping
        );
        expect
          .soft(
            _determineLocale(candidates, approved, mapping),
            `candidates=${JSON.stringify(candidates)}`
          )
          .toBe(expected);
      }
    });
  }
});
