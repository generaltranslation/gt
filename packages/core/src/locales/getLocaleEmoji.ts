import { intlCache } from '../cache/IntlCache';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';

/**
 * @internal
 */
export default function _getLocaleEmoji(
  locale: string,
  customMapping: Record<string, string> = {}
): string {
  if (!_isValidLocale(locale)) return defaultEmoji;

  locale = _standardizeLocale(locale);

  if (customMapping[locale]) return customMapping[locale];

  // if a region is specified, use it!
  const localeObject = intlCache.get('Locale', locale);
  const { region } = localeObject;
  if (region && emojis[region]) return emojis[region];

  // if not, attempt to extrapolate
  const extrapolated = localeObject.maximize();
  const extrapolatedRegion = extrapolated.region || '';

  return (
    exceptions[extrapolated.language] ||
    emojis[extrapolatedRegion] ||
    defaultEmoji
  );
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

const emojis = {
  AF: '🇦🇫', // Afghanistan
  AX: '🇦🇽', // Åland Islands
  AL: '🇦🇱', // Albania
  DZ: '🇩🇿', // Algeria
  AS: '🇦🇸', // American Samoa
  AD: '🇦🇩', // Andorra
  AO: '🇦🇴', // Angola
  AI: '🇦🇮', // Anguilla
  AQ: '🇦🇶', // Antarctica
  AG: '🇦🇬', // Antigua and Barbuda
  AR: '🇦🇷', // Argentina
  AM: '🇦🇲', // Armenia
  AW: '🇦🇼', // Aruba
  AU: '🇦🇺', // Australia
  AT: '🇦🇹', // Austria
  AZ: '🇦🇿', // Azerbaijan
  BS: '🇧🇸', // Bahamas
  BH: '🇧🇭', // Bahrain
  BD: '🇧🇩', // Bangladesh
  BB: '🇧🇧', // Barbados
  BY: '🇧🇾', // Belarus
  BE: '🇧🇪', // Belgium
  BZ: '🇧🇿', // Belize
  BJ: '🇧🇯', // Benin
  BM: '🇧🇲', // Bermuda
  BT: '🇧🇹', // Bhutan
  BO: '🇧🇴', // Bolivia
  BQ: '🇧🇶', // Bonaire, Sint Eustatius and Saba
  BA: '🇧🇦', // Bosnia and Herzegovina
  BW: '🇧🇼', // Botswana
  BV: '🇧🇻', // Bouvet Island
  BR: '🇧🇷', // Brazil
  IO: '🇮🇴', // British Indian Ocean Territory
  BN: '🇧🇳', // Brunei Darussalam
  BG: '🇧🇬', // Bulgaria
  BF: '🇧🇫', // Burkina Faso
  BI: '🇧🇮', // Burundi
  CV: '🇨🇻', // Cabo Verde
  KH: '🇰🇭', // Cambodia
  CM: '🇨🇲', // Cameroon
  CA: '🇨🇦', // Canada
  KY: '🇰🇾', // Cayman Islands
  CF: '🇨🇫', // Central African Republic
  TD: '🇹🇩', // Chad
  CL: '🇨🇱', // Chile
  CN: '🇨🇳', // China
  CX: '🇨🇽', // Christmas Island
  CC: '🇨🇨', // Cocos (Keeling) Islands
  CO: '🇨🇴', // Colombia
  KM: '🇰🇲', // Comoros
  CD: '🇨🇩', // Congo (Democratic Republic)
  CG: '🇨🇬', // Congo (Republic)
  CK: '🇨🇰', // Cook Islands
  CR: '🇨🇷', // Costa Rica
  CI: '🇨🇮', // Côte d'Ivoire
  HR: '🇭🇷', // Croatia
  CU: '🇨🇺', // Cuba
  CW: '🇨🇼', // Curaçao
  CY: '🇨🇾', // Cyprus
  CZ: '🇨🇿', // Czechia
  DK: '🇩🇰', // Denmark
  DJ: '🇩🇯', // Djibouti
  DM: '🇩🇲', // Dominica
  DO: '🇩🇴', // Dominican Republic
  EC: '🇪🇨', // Ecuador
  EG: '🇪🇬', // Egypt
  SV: '🇸🇻', // El Salvador
  GQ: '🇬🇶', // Equatorial Guinea
  ER: '🇪🇷', // Eritrea
  EE: '🇪🇪', // Estonia
  SZ: '🇸🇿', // Eswatini
  ET: '🇪🇹', // Ethiopia
  FK: '🇫🇰', // Falkland Islands
  FO: '🇫🇴', // Faroe Islands
  FJ: '🇫🇯', // Fiji
  FI: '🇫🇮', // Finland
  FR: '🇫🇷', // France
  GF: '🇬🇫', // French Guiana
  PF: '🇵🇫', // French Polynesia
  TF: '🇹🇫', // French Southern Territories
  GA: '🇬🇦', // Gabon
  GM: '🇬🇲', // Gambia
  GE: '🇬🇪', // Georgia
  DE: '🇩🇪', // Germany
  GH: '🇬🇭', // Ghana
  GI: '🇬🇮', // Gibraltar
  GR: '🇬🇷', // Greece
  GL: '🇬🇱', // Greenland
  GD: '🇬🇩', // Grenada
  GP: '🇬🇵', // Guadeloupe
  GU: '🇬🇺', // Guam
  GT: '🇬🇹', // Guatemala
  GG: '🇬🇬', // Guernsey
  GN: '🇬🇳', // Guinea
  GW: '🇬🇼', // Guinea-Bissau
  GY: '🇬🇾', // Guyana
  HT: '🇭🇹', // Haiti
  HM: '🇭🇲', // Heard Island and McDonald Islands
  VA: '🇻🇦', // Holy See
  HN: '🇭🇳', // Honduras
  HK: '🇭🇰', // Hong Kong
  HU: '🇭🇺', // Hungary
  IS: '🇮🇸', // Iceland
  IN: '🇮🇳', // India
  ID: '🇮🇩', // Indonesia
  IR: '🇮🇷', // Iran
  IQ: '🇮🇶', // Iraq
  IE: '🇮🇪', // Ireland
  IM: '🇮🇲', // Isle of Man
  IL: '🇮🇱', // Israel
  IT: '🇮🇹', // Italy
  JM: '🇯🇲', // Jamaica
  JP: '🇯🇵', // Japan
  JE: '🇯🇪', // Jersey
  JO: '🇯🇴', // Jordan
  KZ: '🇰🇿', // Kazakhstan
  KE: '🇰🇪', // Kenya
  KI: '🇰🇮', // Kiribati
  KP: '🇰🇵', // Korea (North)
  KR: '🇰🇷', // Korea (South)
  KW: '🇰🇼', // Kuwait
  KG: '🇰🇬', // Kyrgyzstan
  LA: '🇱🇦', // Laos
  LV: '🇱🇻', // Latvia
  LB: '🇱🇧', // Lebanon
  LS: '🇱🇸', // Lesotho
  LR: '🇱🇷', // Liberia
  LY: '🇱🇾', // Libya
  LI: '🇱🇮', // Liechtenstein
  LT: '🇱🇹', // Lithuania
  LU: '🇱🇺', // Luxembourg
  MO: '🇲🇴', // Macao
  MG: '🇲🇬', // Madagascar
  MW: '🇲🇼', // Malawi
  MY: '🇲🇾', // Malaysia
  MV: '🇲🇻', // Maldives
  ML: '🇲🇱', // Mali
  MT: '🇲🇹', // Malta
  MH: '🇲🇭', // Marshall Islands
  MQ: '🇲🇶', // Martinique
  MR: '🇲🇷', // Mauritania
  MU: '🇲🇺', // Mauritius
  YT: '🇾🇹', // Mayotte
  MX: '🇲🇽', // Mexico
  FM: '🇫🇲', // Micronesia
  MD: '🇲🇩', // Moldova
  MC: '🇲🇨', // Monaco
  MN: '🇲🇳', // Mongolia
  ME: '🇲🇪', // Montenegro
  MS: '🇲🇸', // Montserrat
  MA: '🇲🇦', // Morocco
  MZ: '🇲🇿', // Mozambique
  MM: '🇲🇲', // Myanmar
  NA: '🇳🇦', // Namibia
  NR: '🇳🇷', // Nauru
  NP: '🇳🇵', // Nepal
  NL: '🇳🇱', // Netherlands
  NC: '🇳🇨', // New Caledonia
  NZ: '🇳🇿', // New Zealand
  NI: '🇳🇮', // Nicaragua
  NE: '🇳🇪', // Niger
  NG: '🇳🇬', // Nigeria
  NU: '🇳🇺', // Niue
  NF: '🇳🇫', // Norfolk Island
  MK: '🇲🇰', // North Macedonia
  MP: '🇲🇵', // Northern Mariana Islands
  NO: '🇳🇴', // Norway
  OM: '🇴🇲', // Oman
  PK: '🇵🇰', // Pakistan
  PW: '🇵🇼', // Palau
  PS: '🇵🇸', // Palestine, State of
  PA: '🇵🇦', // Panama
  PG: '🇵🇬', // Papua New Guinea
  PY: '🇵🇾', // Paraguay
  PE: '🇵🇪', // Peru
  PH: '🇵🇭', // Philippines
  PN: '🇵🇳', // Pitcairn
  PL: '🇵🇱', // Poland
  PT: '🇵🇹', // Portugal
  PR: '🇵🇷', // Puerto Rico
  QA: '🇶🇦', // Qatar
  RE: '🇷🇪', // Réunion
  RO: '🇷🇴', // Romania
  RU: '🇷🇺', // Russian Federation
  RW: '🇷🇼', // Rwanda
  BL: '🇧🇱', // Saint Barthélemy
  SH: '🇸🇭', // Saint Helena, Ascension and Tristan da Cunha
  KN: '🇰🇳', // Saint Kitts and Nevis
  LC: '🇱🇨', // Saint Lucia
  MF: '🇲🇫', // Saint Martin (French part)
  PM: '🇵🇲', // Saint Pierre and Miquelon
  VC: '🇻🇨', // Saint Vincent and the Grenadines
  WS: '🇼🇸', // Samoa
  SM: '🇸🇲', // San Marino
  ST: '🇸🇹', // São Tomé and Príncipe
  SA: '🇸🇦', // Saudi Arabia
  SN: '🇸🇳', // Senegal
  RS: '🇷🇸', // Serbia
  SC: '🇸🇨', // Seychelles
  SL: '🇸🇱', // Sierra Leone
  SG: '🇸🇬', // Singapore
  SX: '🇸🇽', // Sint Maarten (Dutch part)
  SK: '🇸🇰', // Slovakia
  SI: '🇸🇮', // Slovenia
  SB: '🇸🇧', // Solomon Islands
  SO: '🇸🇴', // Somalia
  ZA: '🇿🇦', // South Africa
  GS: '🇬🇸', // South Georgia and the South Sandwich Islands
  SS: '🇸🇸', // South Sudan
  ES: '🇪🇸', // Spain
  LK: '🇱🇰', // Sri Lanka
  SD: '🇸🇩', // Sudan
  SR: '🇸🇷', // Suriname
  SJ: '🇸🇯', // Svalbard and Jan Mayen
  SE: '🇸🇪', // Sweden
  CH: '🇨🇭', // Switzerland
  SY: '🇸🇾', // Syrian Arab Republic
  TW: '🇹🇼', // Taiwan
  TJ: '🇹🇯', // Tajikistan
  TZ: '🇹🇿', // Tanzania
  TH: '🇹🇭', // Thailand
  TL: '🇹🇱', // Timor-Leste
  TG: '🇹🇬', // Togo
  TK: '🇹🇰', // Tokelau
  TO: '🇹🇴', // Tonga
  TT: '🇹🇹', // Trinidad and Tobago
  TN: '🇹🇳', // Tunisia
  TR: '🇹🇷', // Türkiye
  TM: '🇹🇲', // Turkmenistan
  TC: '🇹🇨', // Turks and Caicos Islands
  TV: '🇹🇻', // Tuvalu
  UG: '🇺🇬', // Uganda
  UA: '🇺🇦', // Ukraine
  AE: '🇦🇪', // United Arab Emirates
  GB: '🇬🇧', // United Kingdom
  US: '🇺🇸', // United States of America
  UM: '🇺🇲', // United States Minor Outlying Islands
  UY: '🇺🇾', // Uruguay
  UZ: '🇺🇿', // Uzbekistan
  VU: '🇻🇺', // Vanuatu
  VE: '🇻🇪', // Venezuela
  VN: '🇻🇳', // Viet Nam
  VG: '🇻🇬', // Virgin Islands (British)
  VI: '🇻🇮', // Virgin Islands (U.S.)
  WF: '🇼🇫', // Wallis and Futuna
  EH: '🇪🇭', // Western Sahara
  YE: '🇾🇪', // Yemen
  ZM: '🇿🇲', // Zambia
  ZW: '🇿🇼', // Zimbabwe,
  EU: '🇪🇺', // European Union (EU)


  QBR: '🥀 ', // brainrot
} as Record<string, string>;
