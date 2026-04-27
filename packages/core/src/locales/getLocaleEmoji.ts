import { intlCache } from '../cache/IntlCache';
import type { CustomMapping } from './customLocaleMapping';

/**
 * @internal
 */
export default function _getLocaleEmoji(
  locale: string,
  customMapping?: CustomMapping
): string {
  // Check for canonical locale
  const aliasedLocale = locale;
  if (customMapping && shouldUseCanonicalLocale(locale, customMapping)) {
    // Override locale with canonical locale
    locale = (customMapping[locale] as { code: string }).code;
  }

  try {
    const standardizedLocale = getCanonicalLocale(locale) || locale;
    const localeObject = intlCache.get('Locale', standardizedLocale);
    const { language, region } = localeObject;

    // if a custom mapping is specified, use it
    if (customMapping) {
      for (const l of [aliasedLocale, locale, standardizedLocale, language]) {
        const customEmoji = getCustomEmoji(customMapping, l);
        if (customEmoji) return customEmoji;
      }
    }

    // if a region is specified, use it!
    if (region) return getRegionEmoji(region);

    // if not, attempt to extrapolate
    const extrapolated = localeObject.maximize();
    const extrapolatedRegion = extrapolated.region || '';

    return (
      exceptions[extrapolated.language] ||
      getRegionEmoji(extrapolatedRegion)
    );
  } catch {
    return defaultEmoji;
  }
}

// Default language emoji for when none else can be found
const europeAfricaGlobe = '🌍';
const asiaAustraliaGlobe = '🌏';
const scotlandFlag =
  '\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}' +
  '\u{e0063}\u{e0074}\u{e007f}';
const walesFlag =
  '\u{1f3f4}\u{e0067}\u{e0062}\u{e0077}' +
  '\u{e006c}\u{e0073}\u{e007f}';
export const defaultEmoji = europeAfricaGlobe;

// Exceptions to better reflect linguistic and cultural identities
const exceptions = {
  ca: europeAfricaGlobe,
  eu: europeAfricaGlobe,
  ku: europeAfricaGlobe,
  bo: asiaAustraliaGlobe,
  ug: asiaAustraliaGlobe,
  gd: scotlandFlag,
  cy: walesFlag,
  gv: '🇮🇲',
  grc: '🏺',
} as Record<string, string>;

const specialRegionEmojis = {
  EU: '🇪🇺',
  '419': '🌎',
} as Record<string, string>;

const regionalIndicatorOffset = 0x1f1e6 - 'A'.charCodeAt(0);

export function getRegionEmoji(region: string): string {
  const normalizedRegion = region.toUpperCase();
  const specialEmoji = specialRegionEmojis[normalizedRegion];
  if (specialEmoji) return specialEmoji;

  if (!/^[A-Z]{2}$/.test(normalizedRegion)) return defaultEmoji;

  return String.fromCodePoint(
    normalizedRegion.charCodeAt(0) + regionalIndicatorOffset,
    normalizedRegion.charCodeAt(1) + regionalIndicatorOffset
  );
}

function getCanonicalLocale(locale: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
}

const getCustomEmoji = (
  customMapping: CustomMapping,
  locale: string
): string | undefined => {
  const value = customMapping[locale];
  return value && typeof value === 'object' ? value.emoji : undefined;
};

const shouldUseCanonicalLocale = (
  locale: string,
  customMapping: CustomMapping
): boolean => {
  const value = customMapping[locale];
  return !!(
    value &&
    typeof value === 'object' &&
    typeof value.code === 'string' &&
    getCanonicalLocale(value.code)
  );
};
