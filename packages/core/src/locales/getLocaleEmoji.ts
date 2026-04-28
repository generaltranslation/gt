import { intlCache } from '../cache/IntlCache';
import {
  getCustomProperty,
  shouldUseCanonicalLocale,
  type CustomMapping,
} from './customLocaleMapping';
import { _standardizeLocale } from './isValidLocale';

/**
 * @internal
 */
export default function _getLocaleEmoji(
  locale: string,
  customMapping?: CustomMapping
): string {
  const aliasedLocale = locale;
  if (customMapping && shouldUseCanonicalLocale(locale, customMapping)) {
    locale = (customMapping[locale] as { code: string }).code;
  }

  try {
    const standardizedLocale = _standardizeLocale(locale);
    const localeObject = intlCache.get('Locale', standardizedLocale);
    const { language, region } = localeObject;

    if (customMapping) {
      for (const l of [aliasedLocale, locale, standardizedLocale, language]) {
        const customEmoji = getCustomProperty(customMapping, l, 'emoji');
        if (customEmoji) return customEmoji;
      }
    }

    const regionEmoji = region && getSupportedRegionEmoji(region);
    if (regionEmoji) return regionEmoji;

    const extrapolated = localeObject.maximize();

    return (
      exceptions[extrapolated.language] ||
      getRegionEmoji(extrapolated.region || '')
    );
  } catch {
    return defaultEmoji;
  }
}

// Default language emoji for when none else can be found
const europeAfricaGlobe = '🌍';
const asiaAustraliaGlobe = '🌏';
export const defaultEmoji = europeAfricaGlobe;

// Exceptions to better reflect linguistic and cultural identities
const exceptions = {
  ca: europeAfricaGlobe,
  eu: europeAfricaGlobe,
  ku: europeAfricaGlobe,
  bo: asiaAustraliaGlobe,
  ug: asiaAustraliaGlobe,
  gd: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  cy: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
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
  return getSupportedRegionEmoji(region) || defaultEmoji;
}

function getSupportedRegionEmoji(region: string): string | undefined {
  const normalizedRegion = region.toUpperCase();
  const specialEmoji = specialRegionEmojis[normalizedRegion];
  if (specialEmoji) return specialEmoji;

  if (!flagRegions.has(normalizedRegion)) return undefined;

  return String.fromCodePoint(
    normalizedRegion.charCodeAt(0) + regionalIndicatorOffset,
    normalizedRegion.charCodeAt(1) + regionalIndicatorOffset
  );
}
