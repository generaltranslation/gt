import { typesFileError } from './errors/createErrors';
import { T as _T } from './server-dir/buildtime/T';
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
  useTranslations as _useTranslations,
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
  Num as _Num,
  Var as _Var,
  Branch as _Branch,
  Plural as _Plural,
  Derive as _Derive,
  useLocaleDirection as _useLocaleDirection,
} from 'gt-react';
import {
  LocaleSelector as _LocaleSelector,
  RegionSelector as _RegionSelector,
  useSetLocale as _useSetLocale,
  useLocaleSelector as _useLocaleSelector,
  getTranslationsSnapshot,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-react';
import { GTProvider as _GTProvider } from 'gt-react';
import type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-react';
import type { StringFormat } from '@generaltranslation/format/types';
import {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from '@generaltranslation/react-core/pure';

type Message = {
  message: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
};
type Messages = Message[];

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 * @param {string} locale - The locale to use for the translation context.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export function GTProvider(
  _: {
    id?: string;
  } & Partial<Parameters<typeof _GTProvider>[0]>
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
 *  <Plural n={3} singular={<>You have <Num children={n}/> item.</>}>
 *      You have <Num children={n}/> items.
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
T._gtt = 'translate';

export const GtInternalTranslateJsx: typeof _GtInternalTranslateJsx = () => {
  throw new Error(typesFileError);
};
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 *
 * @example
 * ```jsx
 * <Currency
 *    currency="USD"
 * >
 *    1000
 * </Currency>
 * ```
 *
 * @param {any} [children] - Optional content to render inside the currency component.
 * @param {string} [currency] - The currency type (e.g., USD, EUR, etc.).
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {React.JSX.Element} The formatted currency component.
 */
export const Currency: typeof _Currency = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Currency._gtt = 'variable-currency';

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
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {Promise<React.JSX.Element>} The formatted date or time component.
 */
export const DateTime: typeof _DateTime = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';

/**
 * The `<RelativeTime>` component renders a localized relative time string
 * (e.g., "2 hours ago", "in 3 days") using `Intl.RelativeTimeFormat`.
 *
 * @example
 * ```jsx
 * <RelativeTime date={someDate} />
 * ```
 *
 * @param {Date} [date] - A date to compute relative time from now.
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
RelativeTime._gtt = 'variable-relative-time';

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 *
 * @example
 * ```jsx
 * <Num
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    1000
 * </Num>
 * ```
 *
 * @param {any} [children] - Optional content (typically a number) to render inside the component.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {React.JSX.Element} The formatted number component.
 */
export const Num: typeof _Num = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Num._gtt = 'variable-number';

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
Var._gtt = 'variable-variable';

export const GtInternalVar: typeof _GtInternalVar = () => {
  throw new Error(typesFileError);
};
GtInternalVar._gtt = 'variable-variable-automatic';

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
Derive._gtt = 'derive';

/**
 * The `<Branch>` component dynamically renders a specified branch of content or a fallback child component.
 * It allows for flexible content switching based on the `branch` prop and an object of possible branches (`...branches`).
 * If the specified `branch` is present in the `branches` object, it renders the content of that branch.
 * If the `branch` is not found, it renders the provided `children` as fallback content.
 *
 * @example
 * ```jsx
 * <Branch
 *  branch="summary"
 * summary={<p>This is a summary</p>}
 * details={<p>Details here</p>}
 * >
 *   <p>Fallback content</p>
 * </Branch>
 * ```
 * If the `branch` prop is set to `"summary"`, it will render `<p>This is a summary</p>`. If the `branch` is not set or does not match any keys in the branches object, it renders the fallback content `<p>Fallback content</p>`.
 *
 * @param {any} [children] - Fallback content to render if no matching branch is found.
 * @param {string} [name="branch"] - Optional name for the component, used for metadata or tracking purposes.
 * @param {string} [branch] - The name of the branch to render. The component looks for this key in the `...branches` object.
 * @param {...{[key: string]: any}} [branches] - A spread object containing possible branches as keys and their corresponding content as values.
 * @returns {React.JSX.Element} The rendered branch or fallback content.
 */
export const Branch: typeof _Branch = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';

/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural
 *  n={1}
 *  one="There is 1 item"
 *  other="There are {n} items"
 * />
 * ```
 * In this example, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @param {string} [locale] - Optional parameter, the locale to use for pluralization format.
 * @param {...{[key: string]: any}} [branches] - A spread object containing possible plural branches, typically including `one` for singular
 * and `other` for plural forms, but it may vary depending on the locale.
 * @returns {React.JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
export const Plural: typeof _Plural = () => {
  throw new Error(typesFileError);
};
/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} customNames - An optional object to map locales to custom names.
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
 * Resolve the user's locale from a Next Pages Router server-side request.
 *
 * @param context - The GetServerSideProps context for the request.
 * @returns The resolved locale.
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
 * Returns the string translation function `t`.
 *
 * @returns {Function} A translation function that accepts an ICU format string and returns that ICU format string translated.
 * @param {GTTranslationOptions} [options] - Translation options including variables and special `$`-prefixed options.
 * @param {string} [options.$context] - Additional context for the translation.
 * @param {string} [options.$id] - Optional identifier for the translation string.
 * @param {number} [options.$maxChars] - Maximum number of characters for the translated message.
 * @param {boolean} [options.$requiresReview] - Whether the translated message requires approval before use. Must be a boolean literal.
 * @param {StringFormat} [options.$format] - The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'.
 *
 * @example
 * const t = useGT();
 * console.log(t('To be or not to be...'));
 *
 * const t = useGT();
 * return (<>
 *  {
 *     t('My name is {customName}', { customName: "Brian" } )
 *  }
 * </>);
 *
 */
export const useGT: (
  _messages?: Messages
) => (message: string, options?: GTTranslationOptions) => string = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the dictionary access function `t`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 * The returned function accepts interpolation variables.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export const useTranslations: typeof _useTranslations = () => {
  throw new Error(typesFileError);
};

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
 * If no default locale is provided, it defaults to 'en'.
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

/**
 * Registers a message to be translated. Returns the message unchanged if no options are provided.
 * @param {string | string[]} message The message to encode.
 * @param {GTTranslationOptions} [options] The options to encode.
 * @returns The message or array of messages.
 *
 * @note - This function registers the message before the build process. The actual translation does not
 * occur until the m() function is invoked.
 *
 * @note - Message format
 * A message is broken into two parts separated by colons:
 * - interpolated content - the content with interpolated variables
 * - hash + options - a unique identifier for the source content and options for the translation
 *
 * @example - Basic usage
 *
 * const message1 = msg('Hello, World!');
 * console.log(message1); // "Hello, World!"
 *
 * const message2 = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message2); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 *
 * @example - Array usage
 *
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!']);
 * console.log(messages); // ["Hello, Alice!", "Hello, Bob!"]
 *
 * @example - When specifying an id for an array, each message will have a unique id of `${id}.${index}`
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!'], { $id: 'greetings' });
 * // "Hello, Alice!" id: "greetings.0"
 * // "Hello, Bob!" id: "greetings.1"
 */
export const useMessages: (
  _messages?: Messages
) => <T extends string | null | undefined>(
  encodedMsg: T,
  options?: GTTranslationOptions
) => T extends string ? string : T = () => {
  throw new Error(typesFileError);
};

export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
  WithGTServerSideProps,
  WithGTStaticProps,
};

export type { StringFormat };

export {
  msg,
  decodeMsg,
  decodeOptions,
  mFallback,
  gtFallback,
  derive,
  declareVar,
  decodeVars,
  getTranslationsSnapshot,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
};
