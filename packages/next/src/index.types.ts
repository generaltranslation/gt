import { typesFileError } from './errors/createErrors';
import _GTProvider from './provider/GTProvider';
import _T from './server-dir/buildtime/T';
import {
  useGT as _useGT,
  useTranslations as _useTranslations,
  useLocale as _useLocale,
  useLocales as _useLocales,
  useDefaultLocale as _useDefaultLocale,
  useGTClass as _useGTClass,
  useLocaleProperties as _useLocaleProperties,
  Currency as _Currency,
  DateTime as _DateTime,
  Num as _Num,
  Var as _Var,
  Branch as _Branch,
  Plural as _Plural,
  LocaleSelector as _LocaleSelector,
} from 'gt-react/client';

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 * @param {string} locale - The locale to use for the translation context.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export const GTProvider: typeof _GTProvider = () => {
  throw new Error(typesFileError);
};

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
T.gtTransformation = 'translate';

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
Currency.gtTransformation = 'variable-currency';

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
DateTime.gtTransformation = 'variable-datetime';

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
Num.gtTransformation = 'variable-number';

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
Var.gtTransformation = 'variable-variable';

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
Branch.gtTransformation = 'branch';

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
Plural.gtTransformation = 'plural';

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
 * Returns the string translation function `t`.
 *
 * @returns {Function} A translation function that accepts an ICU format string and returns that ICU format string translated.
 *
 * @example
 * const t = useGT();
 * console.log(t('To be or not to be...'));
 *
 * const t = useGT();
 * return (<>
 *  {
 *     t('My name is {customName}', { variables: { customName: "Brian" } } )
 *  }
 * </>);
 *
 */
export const useGT: typeof _useGT = () => {
  throw new Error(typesFileError);
};

/**
 * Returns the dictionary access function `t`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
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
 * Returns the dictionary access function `d`.
 * @deprecated Use the equivalent `useTranslations` function instead. `useDict` is supported as an alias.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = useDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = useDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
export const useDict: typeof _useTranslations = () => {
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
 * Returns the configured GT class instance.
 *
 * @returns {GT} The configured GT class instance.
 *
 * @example
 * const gt = useGTClass();
 * console.log(gt.getLocaleProperties('en-US'));
 */
export const useGTClass: typeof _useGTClass = () => {
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
