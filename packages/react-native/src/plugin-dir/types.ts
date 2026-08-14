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

export type Polyfill = (typeof POLYFILLS)[number];

export const FORCED_POLYFILL_IMPORTS = {
  '@formatjs/intl-displaynames/polyfill':
    '@formatjs/intl-displaynames/polyfill-force',
  '@formatjs/intl-listformat/polyfill':
    '@formatjs/intl-listformat/polyfill-force',
  '@formatjs/intl-relativetimeformat/polyfill':
    '@formatjs/intl-relativetimeformat/polyfill-force',
} as const satisfies Partial<Record<Polyfill, string>>;

export type ForceablePolyfill = keyof typeof FORCED_POLYFILL_IMPORTS;

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
  excludePolyfills?: Polyfill[];
  /* Polyfills that should bypass runtime capability detection */
  forcePolyfills?: ForceablePolyfill[];
}
