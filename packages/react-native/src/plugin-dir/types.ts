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

// Keep the public excludePolyfills values stable while selecting faster runtime
// entrypoints for APIs that Hermes does not provide.
export const POLYFILL_IMPORTS: Record<(typeof POLYFILLS)[number], string> = {
  '@formatjs/intl-getcanonicallocales/polyfill':
    '@formatjs/intl-getcanonicallocales/polyfill',
  '@formatjs/intl-locale/polyfill': '@formatjs/intl-locale/polyfill',
  '@formatjs/intl-displaynames/polyfill':
    '@formatjs/intl-displaynames/polyfill-force',
  '@formatjs/intl-listformat/polyfill':
    '@formatjs/intl-listformat/polyfill-force',
  '@formatjs/intl-pluralrules/polyfill-force':
    '@formatjs/intl-pluralrules/polyfill-force',
  '@formatjs/intl-numberformat/polyfill':
    '@formatjs/intl-numberformat/polyfill',
  '@formatjs/intl-relativetimeformat/polyfill':
    '@formatjs/intl-relativetimeformat/polyfill-force',
  '@formatjs/intl-datetimeformat/polyfill':
    '@formatjs/intl-datetimeformat/polyfill',
  '@formatjs/intl-datetimeformat/add-all-tz':
    '@formatjs/intl-datetimeformat/add-all-tz',
};

export const LOCALE_POLYFILLS = [
  `@formatjs/intl-displaynames/locale-data`,
  `@formatjs/intl-listformat/locale-data`,
  `@formatjs/intl-pluralrules/locale-data`,
  `@formatjs/intl-numberformat/locale-data`,
  `@formatjs/intl-relativetimeformat/locale-data`,
  `@formatjs/intl-datetimeformat/locale-data`,
] as const;

export interface PluginOptions {
  /* List of locales to polyfill */
  locales?: string[];
  /* Gt config object */
  config?: { defaultLocale: string; locales: string[] } & Record<
    string,
    unknown
  >;
  /* Path to the gt config file */
  configFilePath?: string;
  /* Resolved from package.json */
  entryPointFilePath?: string;
  /* Polyfills to exclude */
  excludePolyfills?: (typeof POLYFILLS)[number][];
}
