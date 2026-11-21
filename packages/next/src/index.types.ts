import { typesFileError } from './errors/createErrors';
import { T as _T } from './server-dir/buildtime/T';
import { useLocalizeHref as _useLocalizeHref } from './link/useLocalizeHref';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';
import type {
  WithGTStaticProps,
  WithGTStaticPropsFunction,
} from './pages-dir/withGTStaticProps';
import {
  useLocale as _useLocale,
  useRegion as _useRegion,
  useLocales as _useLocales,
  useDefaultLocale as _useDefaultLocale,
  useLocaleProperties as _useLocaleProperties,
  Currency as _Currency,
  DateTime as _DateTime,
  GtInternalTranslateJsx as _GtInternalTranslateJsx,
  GtInternalVar as _GtInternalVar,
  RelativeTime as _RelativeTime,
  N as _N,
  Num as _Num,
  Var as _Var,
  Select as _Select,
  Ordinal as _Ordinal,
  Plural as _Plural,
  Derive as _Derive,
  useLocaleDirection as _useLocaleDirection,
  useGT,
  useMessages,
} from 'gt-react';
import {
  LocaleSelector as _LocaleSelector,
  RegionSelector as _RegionSelector,
  useSetLocale as _useSetLocale,
  useLocaleSelector as _useLocaleSelector,
} from 'gt-react';
import { GTProvider as _GTProvider } from 'gt-react';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import {
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  ordinal,
  time,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Part,
  type Placeholder,
} from 'gt-i18n';

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} locale - The locale to use for the translation context.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export function GTProvider(
  _: Partial<Parameters<typeof _GTProvider>[0]>
): React.ReactNode {
  throw new Error(typesFileError);
}

/**
 * Build-time translation component that renders its children in the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var>{name}</Var>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={n} one={<>You have <Num>{n}</Num> item.</>}>
 *    You have <Num>{n}</Num> items.
 *  </Plural>
 * </T>
 * ```
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {any} [context] - Additional context for translation key generation.
 *
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
export const T: typeof _T = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
T._gtt = { kind: 'translate' };

export const GtInternalTranslateJsx: typeof _GtInternalTranslateJsx = () => {
  throw new Error(typesFileError);
};
GtInternalTranslateJsx._gtt = { kind: 'translate', automatic: true };

/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 *
 * @example
 * ```jsx
 * <Currency
 *    currency="USD"
 * >
 *    {1000}
 * </Currency>
 * ```
 *
 * @param {number | bigint} [children] - The amount to format.
 * @param {string} currency - The currency type (e.g., USD, EUR, etc.).
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {React.JSX.Element} The formatted currency component.
 */
export const Currency: typeof _Currency = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Currency._gtt = { kind: 'variable', variableType: 'c' };

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime>
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {Date | number} [children] - The date to format, or its timestamp.
 * @param {Intl.DateTimeFormatOptions} [options] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications. Without a style or a date or time field, the medium date style.
 * @returns {Promise<React.JSX.Element>} The formatted date or time component.
 */
export const DateTime: typeof _DateTime = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = { kind: 'variable', variableType: 'd' };

/**
 * The `<RelativeTime>` component renders a localized relative time string
 * (e.g., "2 hours ago", "in 3 days") using `Intl.RelativeTimeFormat`.
 *
 * @example
 * ```jsx
 * <RelativeTime>{someDate}</RelativeTime>
 * ```
 *
 * @param {Date} [children] - A date to compute relative time from now.
 * @param {number} [value] - Explicit numeric value. Requires `unit`.
 * @param {Intl.RelativeTimeFormatUnit} [unit] - The unit of time.
 * @param {Date} [baseDate] - Base date for computing relative time. Defaults to `new Date()` at render time. Required for hydration safety.
 * @param {Intl.RelativeTimeFormatOptions} [options={}] - Formatting options.
 * @returns {Promise<React.JSX.Element>} The formatted relative time component.
 */
export const RelativeTime: typeof _RelativeTime = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = { kind: 'variable', variableType: 'rt' };

/**
 * The `<N>` component renders the count of the `<Plural>` it is in, formatted as a number, as `#` does in ICU.
 * A translation can show it in any branch of that plural.
 *
 * @example
 * ```jsx
 * <Plural n={count} one="One file">
 *    <N /> files
 * </Plural>
 * ```
 *
 * @returns {React.JSX.Element} The formatted count.
 */
export const N: typeof _N = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
N._gtt = { kind: 'variable', variableType: '#' };

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 *
 * @example
 * ```jsx
 * <Num
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    {1000}
 * </Num>
 * ```
 *
 * @param {number | bigint} [children] - The number to format.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {React.JSX.Element} The formatted number component.
 */
export const Num: typeof _Num = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Num._gtt = { kind: 'variable', variableType: 'n' };

/**
 * The `<Var>` component renders a variable value, which can either be passed as `children` or a `value`.
 * If `children` is provided, it will be used; otherwise, the `value` is rendered.
 *
 * @example
 * ```jsx
 * <Var>
 *    John
 * </Var>
 * ```
 *
 * @param {any} [children] - The content to render inside the component. If provided, it will take precedence over `value`.
 * @returns {React.JSX.Element} The rendered variable component with either `children` or `value`.
 */
export const Var: typeof _Var = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Var._gtt = { kind: 'variable', variableType: 'v' };

export const GtInternalVar: typeof _GtInternalVar = () => {
  throw new Error(typesFileError);
};
GtInternalVar._gtt = { kind: 'variable', variableType: 'v', automatic: true };

/**
 * Marks JSX children as derivable by the GT compiler and CLI.
 *
 * Use `<Derive>` inside translated JSX when child content is computed from
 * source code, but should still be discovered during extraction instead of
 * treated as a runtime interpolation variable. The CLI attempts to resolve the
 * derivable children into every possible static value and includes those values
 * in the source content that gets translated.
 *
 * `<Derive>` renders its children unchanged at runtime.
 *
 * Run `gt validate` after adding or changing `<Derive>` usage to verify that
 * each derivable expression can be resolved by the CLI before translating or
 * building.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * <T>
 *   <Derive>
 *      {getSubject()}
 *   </Derive>
 *   is going to school today.
 * </T>
 * ```
 *
 * @param {T extends React.ReactNode} children - JSX content to derive for translation extraction.
 * @returns {T} The same children, unchanged at runtime.
 */
export const Derive: typeof _Derive = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Derive._gtt = { kind: 'derive' };

/**
 * The `<Select>` component dynamically renders a specified branch of content or a fallback child component.
 * It allows for flexible content switching based on the `value` prop and an object of possible branches (`...branches`).
 * If the specified `value` is present in the `branches` object, it renders the content of that branch.
 * If the `value` is not found, it renders the provided `children` as fallback content.
 *
 * @example
 * ```jsx
 * <Select
 *  value={view}
 *  summary={<p>This is a summary</p>}
 *  details={<p>Details here</p>}
 * >
 *  <p>Fallback content</p>
 * </Select>
 * ```
 * If `view` is `"summary"`, it renders `<p>This is a summary</p>`. If `view` matches none of the branches, it renders the children, `<p>Fallback content</p>`.
 *
 * @param {string | number | boolean} value - The value that names the branch to render.
 * @param {any} [children] - The content to render when no branch matches. Required unless the branches cover every value of `value`.
 * @param {...{[key: string]: any}} [branches] - The possible branches as keys and their content as values.
 * @returns {React.JSX.Element} The rendered branch.
 */
export const Select: typeof _Select = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Select._gtt = { kind: 'select' };

/**
 * The `<Plural>` component renders the branch that fits the number `n`, chosen as ICU does: an exact
 * branch such as `_0` first, then the plural category of `n` in the current locale (`zero`, `one`, `two`,
 * `few`, `many`), then the children.
 *
 * @example
 * ```jsx
 * <Plural n={count} _0="There are no items" one="There is 1 item">
 *  There are many items
 * </Plural>
 * ```
 * In this example, if `count` is 0, it renders `"There are no items"`. In English, if `count` is 1, it renders
 * `"There is 1 item"`, and for any other number `"There are many items"`.
 *
 * @param {number | bigint} n - The number that picks the branch.
 * @param {any} children - The content to render when no branch fits.
 * @param {...{[key: string]: any}} [branches] - Branches for the plural categories `zero`, `one`, `two`, `few` and `many`,
 * and for exact numbers, written `_0`, `_1` and so on.
 * @returns {React.JSX.Element} The rendered content of the branch that fits `n`.
 */
export const Plural: typeof _Plural = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = { kind: 'plural' };

/**
 * The `<Ordinal>` component is `<Plural>` for ordinals such as 1st, 2nd and 3rd: it renders the branch that
 * fits the number `n`, an exact branch such as `_1` first, then the ordinal category of `n` in the current
 * locale (`zero`, `one`, `two`, `few`, `many`), then the children.
 *
 * @example
 * ```jsx
 * <Ordinal
 *   n={place}
 *   one={<><Num>{place}</Num>st</>}
 *   two={<><Num>{place}</Num>nd</>}
 *   few={<><Num>{place}</Num>rd</>}
 * >
 *   <Num>{place}</Num>th
 * </Ordinal>
 * ```
 * In English this renders `1st`, `2nd`, `3rd`, `4th`, `11th`, `21st` and so on.
 *
 * @param {number | bigint} n - The number that picks the branch.
 * @param {any} children - The content to render when no branch fits.
 * @param {...{[key: string]: any}} [branches] - Branches for the ordinal categories `zero`, `one`, `two`, `few` and `many`,
 * and for exact numbers, written `_0`, `_1` and so on.
 * @returns {React.JSX.Element} The rendered content of the branch that fits `n`.
 */
export const Ordinal: typeof _Ordinal = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Ordinal._gtt = { kind: 'ordinal' };

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export const LocaleSelector: typeof _LocaleSelector = () => {
  throw new Error(typesFileError);
};

/**
 * A dropdown component that allows users to select a region.
 * @param {string[]} regions - An optional list of ISO 3166 region codes to use for the dropdown. If not provided, regions are inferred from the supported locales in the `<GTProvider>` context.
 * @returns {React.ReactElement | null} The rendered region dropdown component or null to prevent rendering.
 */
export const RegionSelector: typeof _RegionSelector = () => {
  throw new Error(typesFileError);
};

/**
 * Read the active locale resolved by Next.js internationalized routing.
 *
 * @param context - The GetServerSideProps context for the request.
 * @returns The active Next.js locale, or the default locale when Next.js does not provide one.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(_: GetServerSidePropsContext<Params, Preview>): string {
  throw new Error(typesFileError);
}

/**
 * Wraps a Pages Router `getServerSideProps` function and adds the resolved GT
 * locale and translations snapshot to returned page props.
 */
export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(typesFileError);
}

/**
 * Wraps a Pages Router `getStaticProps` function and adds the generated locale
 * and its translation snapshot. The default locale uses an empty snapshot.
 */
export const withGTStaticProps: WithGTStaticPropsFunction = () => {
  throw new Error(typesFileError);
};

/**
 * Checks whether a locale is valid and supported by the current gt-next config.
 *
 * @param locale - The locale candidate to validate.
 * @returns True when the locale resolves to one of the configured locales.
 */
export function isLocaleSupported(_: unknown): boolean {
  throw new Error(typesFileError);
}

/**
 * Returns the user's current locale.
 *
 * @returns {string} BCP 47 locale tag, e.g., 'en-US'.
 *
 * @example
 * const locale = useLocale();
 * console.log(locale); // 'en-US'
 */
export const useLocale: typeof _useLocale = () => {
  throw new Error(typesFileError);
};

/**
 * Returns a function that localizes hrefs the same way `gt-next/link` does,
 * for navigation that does not render a `<Link>`, such as `router.push()` or
 * a Button `href`. Works in Server and Client Components.
 *
 * @example
 * const localizeHref = useLocalizeHref();
 * localizeHref('/checkout'); // '/fr/checkout', or '/checkout' for the default locale
 */
export const useLocalizeHref: typeof _useLocalizeHref = () => {
  throw new Error(typesFileError);
};

export const useSetLocale: typeof _useSetLocale = () => {
  throw new Error(typesFileError);
};

export const useLocaleSelector: typeof _useLocaleSelector = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the user's current region.
 *
 * @returns {string | undefined} ISO 3166 region code, e.g., 'US', or undefined if not set.
 *
 * @example
 * const region = useRegion();
 * console.log(region); // 'US'
 */
export const useRegion: typeof _useRegion = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the user's list of supported locales.
 *
 * @returns {string[]} List of BCP 47 locale tags, e.g., ['en-US', 'fr', 'jp'].
 *
 * @example
 * const locales = useLocales();
 * console.log(locale); // ['en-US', 'fr', 'jp]
 */
export const useLocales: typeof _useLocales = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the application's default locale.
 *
 * If no default locale is provided, it uses the library default locale.
 *
 * @returns {string} A BCP 47 locale tag, e.g., 'en-US'.
 *
 * @example
 * const locale = useDefaultLocale();
 * console.log(locale); // 'en-US'
 */
export const useDefaultLocale: typeof _useDefaultLocale = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the locale properties for the given locale.
 *
 * @param {string} locale - The locale to get the properties for.
 * @returns {LocaleProperties} The locale properties for the given locale.
 *
 * @example
 * const localeProperties = useLocaleProperties('en-US');
 * console.log(localeProperties);
 */
export const useLocaleProperties: typeof _useLocaleProperties = () => {
  throw new Error(typesFileError);
};

/**
 * Retrieves the text direction ('ltr' or 'rtl') for the current or specified locale from the `<GTProvider>` context.
 *
 * If no locale is provided, the direction for the current user's locale is returned.
 *
 * @param {string} [locale] - Optional locale code (e.g., 'ar', 'en-US'). If omitted, uses the current locale from context.
 * @returns {'ltr' | 'rtl'} The text direction for the locale: 'rtl' for right-to-left languages, otherwise 'ltr'.
 *
 * @example
 * const dir = useLocaleDirection(); // e.g., 'ltr'
 * const arabicDir = useLocaleDirection('ar'); // 'rtl'
 */
export const useLocaleDirection: typeof _useLocaleDirection = () => {
  throw new Error(typesFileError);
};

export type {
  GT,
  GTOptions,
  M,
  Msg,
  Part,
  Placeholder,
  WithGTServerSideProps,
  WithGTStaticProps,
};

export {
  useGT,
  useMessages,
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  ordinal,
  time,
  getTranslationsSnapshot,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
};
