import { intlCache } from '../cache/IntlCache';
import {
  shouldUseCanonicalLocale,
  type CustomMapping,
} from './customLocaleMapping';

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
      exceptions[extrapolated.language] || getRegionEmoji(extrapolatedRegion)
    );
  } catch {
    return defaultEmoji;
  }
}

// Default language emoji for when none else can be found
const europeAfricaGlobe = '🌍';
const asiaAustraliaGlobe = '🌏';
const scotlandFlag =
  '\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}';
const walesFlag =
  '\u{1f3f4}\u{e0067}\u{e0062}\u{e0077}\u{e006c}\u{e0073}\u{e007f}';
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

const flagRegions = new Set(
  'AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CD CG CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(
    ' '
  )
);

const regionalIndicatorOffset = 0x1f1e6 - 'A'.charCodeAt(0);

export function getRegionEmoji(region: string): string {
  const normalizedRegion = region.toUpperCase();
  const specialEmoji = specialRegionEmojis[normalizedRegion];
  if (specialEmoji) return specialEmoji;

  if (!flagRegions.has(normalizedRegion)) return defaultEmoji;

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
