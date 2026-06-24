export const POLYFILLS = [
  '@formatjs/intl-getcanonicallocales/polyfill',
  '@formatjs/intl-locale/polyfill',
  '@formatjs/intl-displaynames/polyfill',
  '@formatjs/intl-listformat/polyfill',
  '@formatjs/intl-pluralrules/polyfill-force', // https://github.com/formatjs/formatjs/issues/4463
  '@formatjs/intl-numberformat/polyfill',
  '@formatjs/intl-relativetimeformat/polyfill',
  '@formatjs/intl-datetimeformat/polyfill',
  '@formatjs/intl-datetimeformat/add-all-tz',
] as const;

export const LOCALE_POLYFILLS = [
  '@formatjs/intl-displaynames/locale-data',
  '@formatjs/intl-listformat/locale-data',
  '@formatjs/intl-pluralrules/locale-data',
  '@formatjs/intl-numberformat/locale-data',
  '@formatjs/intl-relativetimeformat/locale-data',
  '@formatjs/intl-datetimeformat/locale-data',
] as const;
