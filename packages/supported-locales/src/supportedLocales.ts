const supportedLocales = {
  af: ['af'], // Afrikaans
  am: ['am'], // Amharic
  ar: [
    // Arabic
    'ar',
    'ar-AE', // United Arab Emirates
    'ar-EG', // Egypt
    'ar-LB', // Lebanon
    'ar-MA', // Morocco
    'ar-SA', // Saudi Arabia
  ],
  bg: ['bg'], // Bulgarian
  bn: ['bn'], // Bengali
  bs: ['bs'], // Bosnian
  ca: ['ca'], // Catalan
  cs: ['cs'], // Czech
  cy: ['cy'], // Welsh
  da: ['da'], // Danish
  de: [
    // German
    'de',
    'de-AT', // Austria
    'de-CH', // Switzerland
  ],
  el: [
    // Greek
    'el',
    'el-CY', // Cyprus
  ],
  en: [
    // English
    'en',
    'en-AU', // Australia
    'en-CA', // Canada
    'en-GB', // United Kingdom
    'en-NZ', // New Zealand
    'en-US', // United States
  ],
  es: [
    // Spanish
    'es', // Spain
    'es-419', // Latin America
    'es-AR', // Argentina
    'es-CL', // Chile
    'es-CO', // Colombia
    'es-MX', // Mexico
    'es-PE', // Peru
    'es-US', // United States
    'es-VE', // Venezuela
  ],
  et: ['et'], // Estonian
  fa: ['fa'], // Persian
  fi: ['fi'], // Finnish
  fil: ['fil'], // Filipino
  fr: [
    // French
    'fr', // France
    'fr-BE', // Belgium
    'fr-CM', // Cameroon
    'fr-CA', // Canada
    'fr-CH', // Switzerland
    'fr-SN', // Senegal
  ],
  gu: ['gu'], // Gujarati
  hi: ['hi'], // Hindi
  he: ['he'], // Hebrew
  hr: ['hr'], // Croatian
  hu: ['hu'], // Hungarian
  hy: ['hy'], // Armenian
  id: ['id'], // Indonesian
  is: ['is'], // Icelandic
  it: [
    // Italian
    'it', // Italy
    'it-CH', // Switzerland
  ],
  ja: ['ja'], // Japanese
  ka: ['ka'], // Georgian
  kk: ['kk'], // Kazakh
  kn: ['kn'], // Kannada
  ko: ['ko'], // Korean
  la: ['la'], // Latin
  lt: ['lt'], // Lithuanian
  lv: ['lv'], // Latvian
  mk: ['mk'], // Macedonian
  ml: ['ml'], // Malayalam
  mn: ['mn'], // Mongolian
  mr: ['mr'], // Marathi
  ms: ['ms'], // Malay
  my: ['my'], // Burmese
  nl: [
    // Dutch
    'nl', // Netherlands
    'nl-BE', // Belgium
  ],
  no: ['no'], // Norwegian
  pa: ['pa'], // Punjabi
  pl: ['pl'], // Polish
  pt: [
    // Portuguese
    'pt',
    'pt-BR', // Brazil
    'pt-PT', // Portugal
  ],
  ro: ['ro'], // Romanian
  ru: ['ru'], // Russian
  sk: ['sk'], // Slovak
  sl: ['sl'], // Slovenian
  so: ['so'], // Somali
  sq: ['sq'], // Albanian
  sr: ['sr'], // Serbian
  sv: ['sv'], // Swedish
  sw: [
    // Swahili
    'sw',
    'sw-KE', // Kenya
    'sw-TZ', // Tanzania
  ],
  ta: ['ta'], // Tamil
  te: ['te'], // Telugu
  th: ['th'], // Thai
  tl: ['tl'], // Tagalog
  tr: ['tr'], // Turkish
  uk: ['uk'], // Ukrainian
  ur: ['ur'], // Urdu
  vi: ['vi'], // Vietnamese
  zh: [
    // Chinese
    'zh',
    'zh-HK', // Hong Kong
    'zh-SG', // Singapore
    'zh-TW', // Taiwan
  ],
} as {
  [language: string]: string[];
};

export default supportedLocales;
