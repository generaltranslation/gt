import * as React$1 from 'react';
import React__default, { ReactElement } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';

type Child = React__default.ReactNode;
type Children = Child[] | Child;
type GTProp = {
    id: number;
    transformation?: string;
    children?: Children;
} & Record<string, any>;
type TaggedChild = React__default.ReactNode | TaggedElement;
type TaggedChildren = TaggedChild[] | TaggedChild;
type TaggedElementProps = Record<string, any> & {
    'data-_gt': GTProp;
};
type TaggedElement = React__default.ReactElement<TaggedElementProps>;
type TaggedEntry = string | TaggedChildren;
type TaggedDictionaryEntry = TaggedEntry | [TaggedEntry] | [TaggedEntry, Metadata];
type FlattenedTaggedDictionary = {
    [key: string]: TaggedDictionaryEntry;
};
type Entry = string | ReactElement;
type Metadata = {
    singular?: Entry;
    plural?: Entry;
    zero?: Entry;
    dual?: Entry;
    one?: Entry;
    two?: Entry;
    few?: Entry;
    many?: Entry;
    other?: Entry;
    context?: string;
    variablesOptions?: Record<string, any>;
    [key: string]: any;
};
type Variable = {
    key: string;
    id?: number;
    variable?: 'variable' | 'number' | 'datetime' | 'currency';
};
type TranslatedElement = {
    type: string;
    props: {
        'data-_gt': {
            id: number;
            [key: string]: any;
        };
        children?: TranslatedChildren;
    };
};
type TranslatedChild = TranslatedElement | string | Variable;
type TranslatedChildren = TranslatedChild | TranslatedChild[];
type TranslatedContent = string | (string | Variable)[];
type TranslationError = {
    state: 'error';
    error: string;
    code?: number;
};
type TranslationSuccess = {
    state: 'success';
    target: TranslatedChildren | TranslatedContent;
};
type TranslationLoading = {
    state: 'loading';
};
type TranslationsObject = {
    [id: string]: {
        [hash: string]: TranslationSuccess | TranslationLoading | TranslationError;
    };
};
type RenderMethod = 'skeleton' | 'replace' | 'default';
type TranslateContentCallback = (params: {
    source: any;
    targetLocale: string;
    metadata: {
        hash: string;
        context?: string;
    } & Record<string, any>;
}) => Promise<void>;
type TranslateChildrenCallback = (params: {
    source: any;
    targetLocale: string;
    metadata: {
        hash: string;
        context?: string;
    } & Record<string, any>;
}) => Promise<void>;
type GTContextType = {
    translateDictionaryEntry: (id: string, options?: Record<string, any>) => React__default.ReactNode;
    translateContent: TranslateContentCallback;
    translateChildren: TranslateChildrenCallback;
    locale: string;
    defaultLocale: string;
    translations: TranslationsObject | null;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
    translationEnabled?: boolean;
};

declare const GTContext: React$1.Context<GTContextType | undefined>;

/**
 * Hook to retrieve the browser's default locale, with support for a fallback and locale stored in a cookie.
 *
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if the browser locale is not available.
 * @param {string} [cookieName=localeCookieName] - The name of the cookie to check for a stored locale. If omitted, no cookie is used.
 * @returns {string} The resolved browser locale, either from the cookie, browser settings, or the default locale.
 *
 * @example
 * const browserLocale = useBrowserLocale('en-US');
 * console.log(browserLocale); // Outputs the browser's locale, or 'en-US' if unavailable
 *
 * @example
 * const browserLocale = useBrowserLocale('fr', 'localeCookie');
 * console.log(browserLocale); // Outputs locale from cookie 'localeCookie' if available, or browser's locale otherwise
 *
 * @description
 * This hook attempts to determine the browser's preferred locale. If a locale is stored in a cookie (specified by `cookieName`),
 * it will take precedence. If not, it falls back to the `navigator.language` or `navigator.userLanguage`. If none of these are available,
 * the provided `defaultLocale` is used.
 */
declare function useBrowserLocale(defaultLocale?: string, locales?: string[]): string;

declare function useRuntimeTranslation({ targetLocale, projectId, devApiKey, runtimeUrl, defaultLocale, renderSettings, setTranslations, ...metadata }: {
    targetLocale: string;
    projectId?: string;
    defaultLocale?: string;
    devApiKey?: string;
    runtimeUrl?: string;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    setTranslations: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}): {
    translationEnabled: boolean;
    translateContent: TranslateContentCallback;
    translateChildren: TranslateChildrenCallback;
};

declare function renderVariable({ variableType, variableName, variableValue, variableOptions, locales, }: {
    variableType: "variable" | "number" | "datetime" | "currency";
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
    locales: string[];
}): React.JSX.Element;

declare function ClientProvider({ children, dictionary, initialTranslations, translationPromises, locale, defaultLocale, translationRequired, dialectTranslationRequired, locales, requiredPrefix, renderSettings, projectId, devApiKey, runtimeUrl, runtimeTranslations, }: {
    children: any;
    dictionary: FlattenedTaggedDictionary;
    initialTranslations: TranslationsObject;
    translationPromises: Record<string, Promise<TranslatedChildren>>;
    locale: string;
    locales: string[];
    defaultLocale: string;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    requiredPrefix: string | undefined;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string;
    runtimeTranslations?: boolean;
}): React__default.JSX.Element;

/**
 * The `<Branch>` component dynamically renders a specified branch of content or a fallback child component.
 * It allows for flexible content switching based on the `branch` prop and an object of possible branches (`...branches`).
 * If the specified `branch` is present in the `branches` object, it renders the content of that branch.
 * If the `branch` is not found, it renders the provided `children` as fallback content.
 *
 * @example
 * ```jsx
 * <Branch branch="summary" summary={<p>This is a summary</p>} details={<p>Details here</p>}>
 *   <p>Fallback content</p>
 * </Branch>
 * ```
 * If the `branch` prop is set to `"summary"`, it will render `<p>This is a summary</p>`. If the `branch` is not set or does not match any keys in the branches object, it renders the fallback content `<p>Fallback content</p>`.
 *
 * @param {any} [children] - Fallback content to render if no matching branch is found.
 * @param {string} [name="branch"] - Optional name for the component, used for metadata or tracking purposes.
 * @param {string} [branch] - The name of the branch to render. The component looks for this key in the `...branches` object.
 * @param {object} [branches] - An object containing possible branches as keys and their corresponding content as values.
 * @returns {JSX.Element} The rendered branch or fallback content.
 */
declare function Branch({ children, name, branch, ...props }: {
    children?: any;
    name?: string;
    branch?: string;
    [key: string]: any;
}): react_jsx_runtime.JSX.Element;
declare namespace Branch {
    var gtTransformation: string;
}

/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural n={1} one="There is 1 item">
 *   There are {n} items
 * </Plural>
 * ```
 * In this example, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @returns {JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
declare function Plural({ children, n, ...props }: {
    children?: any;
    n?: number;
    [key: string]: any;
}): react_jsx_runtime.JSX.Element;
declare namespace Plural {
    var gtTransformation: string;
}

/**
 * Retrieves the application's default locale from the `<GTProvider>` context.
 *
 * If no default locale is passed to the `<GTProvider>`, it defaults to providing 'en'.
 *
 * @returns {string} The application's default locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useDefaultLocale();
 * console.log(locale); // 'en-US'
 */
declare function useDefaultLocale(): string;

/**
 * `useElement()` hook which gets the translation function `t()` provided by `<GTProvider>`.
 *
 * **`t()` returns only JSX elements.** For returning strings as well, see `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns it as a JSX element
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns it as a JSX element
 */
declare function useElement(id?: string): (id: string, options?: Record<string, any>) => React__default.JSX.Element;

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
declare function useGT(id?: string): (id: string, options?: Record<string, any>) => React__default.ReactNode;

/**
 * Retrieves the user's locale from the `<GTProvider>` context.
 *
 * @returns {string} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useLocale();
 * console.log(locale); // 'en-US'
 */
declare function useLocale(): string;

/**
 * Translation component that handles rendering translated content, including plural forms.
 * Used with the required `id` parameter instead of `const t = useGT()`.
 *
 * @param {string} [id] - Required identifier for the translation string.
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {any} [context] - Additional context used for translation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name">{name}</Var>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Using plural translations:
 * <T id="item_count">
 *  <Plural n={n} singular={<>You have <Num value={n}/> item</>}>
 *      You have <Num value={n}/> items
 *  </Plural>
 * </T>
 * ```
 *
 */
declare function T({ children, id, ...props }: {
    children: any;
    id: string;
    context?: string;
    [key: string]: any;
}): React__default.JSX.Element | undefined;
declare namespace T {
    var gtTransformation: string;
}

/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <Currency
 *    name="price"
 *    currency="USD"
 * >
 *    1000
 * </Currency>
 * ```
 *
 * @param {any} [children] - Optional content to render inside the currency component.
 * @param {string} [name] - Optional name for the currency field.
 * @param {any} [value] - The default value to be used.
 * @param {string} [currency] - The currency type (e.g., USD, EUR, etc.).
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {JSX.Element} The formatted currency component.
 */
declare function Currency({ children, value, name, currency, locales, options, }: {
    children?: any;
    name?: string;
    value?: any;
    currency?: string;
    locales?: string[];
    options?: Intl.NumberFormatOptions;
}): React__default.JSX.Element;
declare namespace Currency {
    var gtTransformation: string;
}

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <DateTime
 *    name="createdAt"
 * >
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {string} [name="date"] - Optional name for the date field, used for metadata purposes.
 * @param {string|number|Date} [value] - The default value for the date. Can be a string, number (timestamp), or `Date` object.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {JSX.Element} The formatted date or time component.
 */
declare function DateTime({ children, value, name, locales, options, }: {
    children?: any;
    name?: string;
    value?: any;
    locales?: string[];
    options?: Intl.DateTimeFormatOptions;
}): React__default.JSX.Element;
declare namespace DateTime {
    var gtTransformation: string;
}

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <Num
 *    name="quantity"
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    1000
 * </Num>
 * ```
 *
 * @param {any} [children] - Optional content (typically a number) to render inside the component.
 * @param {string} [name="n"] - Optional name for the number field, used for metadata purposes.
 * @param {string|number} [value] - The default value for the number. Can be a string or number. Strings will be parsed to numbers.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {JSX.Element} The formatted number component.
 */
declare function Num({ children, value, name, locales, options, }: {
    children?: any;
    name?: string;
    value?: any;
    locales?: string[];
    options?: Intl.NumberFormatOptions;
}): React__default.JSX.Element;
declare namespace Num {
    var gtTransformation: string;
}

/**
 * The `<Var>` component renders a variable value, which can either be passed as `children` or a `value`.
 * If `children` is provided, it will be used; otherwise, the `value` is rendered.
 *
 * @example Inline usage:
 * ```jsx
 *  function MyComponent() {
 *     return (
 *          <T id="user">
 *              <p>
 *                  Hello, <Var> John </Var>!
 *              </p>
 *          </T>
 *      );
 *  }
 * ```
 *
 * @example Dictionary Usage:
 * ```jsx
 *  // dictionary.jsx
 *  const dictionary = {
 *      user: (
 *          <>
 *              Hello, <Var name="user-name" />! Your dog's name is <Var name="dog-name"/>.
 *          </>
 *      ),
 *  }
 *
 *  // component.jsx
 *  function MyComponent() {
 *      const t = useGT();
 *      return (
 *          <p>
 *              { t('user', { 'user-name': 'John', 'dog-name': 'Rex' }) }
 *          </p>
 *      );
 *  }
 * ```
 *
 *
 * @param {any} [children] - The content to render inside the component. If provided, it will take precedence over `value`.
 * @param {string} [name] - Optional name for the variable, used for metadata purposes.
 * @param {any} [value] - The default value to be displayed if `children` is not provided.
 * @returns {JSX.Element} The rendered variable component with either `children` or `value`.
 */
declare function Var({ children, name, value, }: {
    children?: any;
    name?: string;
    value?: any;
}): React__default.JSX.Element;
declare namespace Var {
    var gtTransformation: string;
}

export { Branch, ClientProvider, Currency, DateTime, GTContext, Num, Plural, T, Var, renderVariable, useBrowserLocale, useDefaultLocale, useElement, useGT, useLocale, useRuntimeTranslation };
