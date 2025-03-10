import * as React$1 from 'react';
import React__default from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';

type Entry = string;
type Metadata = {
    context?: string;
    variablesOptions?: Record<string, any>;
    [key: string]: any;
};
type DictionaryEntry = Entry | [Entry] | [Entry, Metadata];
type Dictionary = {
    [key: string]: Dictionary | DictionaryEntry;
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
    [hash: string]: TranslationSuccess | TranslationLoading | TranslationError;
};
type MessagesContent = string;
type MessagesObject = {
    [id: string]: MessagesContent;
};
type CustomLoader = (locale: string) => Promise<any>;
type RenderMethod = 'skeleton' | 'replace' | 'default';
type DictionaryTranslationOptions = {
    variables?: Record<string, any>;
    variablesOptions?: Record<string, Intl.NumberFormatOptions | Intl.DateTimeFormatOptions>;
};
type InlineTranslationOptions = {
    context?: string;
    id?: string;
} & DictionaryTranslationOptions;

type TranslateContentCallback = (params: {
    source: any;
    targetLocale: string;
    metadata: {
        hash: string;
        context?: string;
    } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;
type TranslateChildrenCallback = (params: {
    source: any;
    targetLocale: string;
    metadata: {
        hash: string;
        context?: string;
    } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;

type GTContextType = {
    registerContentForTranslation: TranslateContentCallback;
    registerJsxForTranslation: TranslateChildrenCallback;
    _internalUseGTFunction: (string: string, options?: InlineTranslationOptions) => string;
    _internalUseDictFunction: (id: string, options?: DictionaryTranslationOptions) => string;
    runtimeTranslationEnabled: boolean;
    locale: string;
    locales: string[];
    setLocale: (locale: string) => void;
    defaultLocale: string;
    translations: TranslationsObject | null;
    messages: MessagesObject | null;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
};
type ClientProviderProps = {
    children: any;
    dictionary: Dictionary;
    initialTranslations: TranslationsObject;
    messages: MessagesObject;
    locale: string;
    locales: string[];
    _versionId?: string;
    dictionaryEnabled?: boolean;
    defaultLocale: string;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    runtimeTranslationEnabled: boolean;
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string | null;
    onLocaleChange?: () => void;
    cookieName?: string;
};

declare const GTContext: React$1.Context<GTContextType | undefined>;

declare function useRuntimeTranslation({ projectId, devApiKey, locale, versionId, defaultLocale, runtimeUrl, renderSettings, setTranslations, runtimeTranslationEnabled, ...globalMetadata }: {
    projectId?: string;
    devApiKey?: string;
    locale: string;
    versionId?: string;
    defaultLocale?: string;
    runtimeUrl?: string | null;
    runtimeTranslationEnabled: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    setTranslations: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}): {
    registerContentForTranslation: TranslateContentCallback;
    registerJsxForTranslation: TranslateChildrenCallback;
};

declare function renderVariable({ variableType, variableName, variableValue, variableOptions, locales, }: {
    variableType: 'variable' | 'number' | 'datetime' | 'currency';
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
    locales: string[];
}): React.JSX.Element;

declare function ClientProvider({ children, dictionary, initialTranslations, messages, locale: _locale, _versionId, defaultLocale, translationRequired, dialectTranslationRequired, locales, renderSettings, projectId, devApiKey, runtimeUrl, runtimeTranslationEnabled, onLocaleChange, cookieName, }: ClientProviderProps): React__default.JSX.Element;

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
 * @param {string} [locale] - Optional parameter, the locale to use for pluralization format. If not provided and wrapped
 *  in <GTProvider> will automatically populate this value as user's current locale. If not provided and not wrapped in
 *  <GTProvider>, will use the library default locale (en-US).
 * @returns {JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
declare function Plural({ children, n, locale, ...props }: {
    children?: any;
    n?: number;
    locale?: string;
    [key: string]: any;
}): react_jsx_runtime.JSX.Element;
declare namespace Plural {
    var gtTransformation: string;
}

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
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
declare function useGT(): (string: string, options?: InlineTranslationOptions) => string;

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
 * Gets the dictionary access function `d` provided by `<GTProvider>`.
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
declare function useDict(id?: string): (id: string, options?: DictionaryTranslationOptions) => string;

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
 * Build-time translation component that renders its children in the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name" value={firstname}>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.</>}>
 *      You have <Num value={n}/> items.
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
declare function T({ children, id, context, }: {
    children: any;
    id?: string;
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
 * @param {string[]} [locales] - Optional locales to use for currency formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
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
 * @param {string[]} [locales] - Optional locales to use for date formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
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
 *  // dictionary.js
 *  const dictionary = {
 *      user: "Hello {user-name}! Your dog's name is {dog-name}",
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

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
declare function LocaleSelector({ locales: _locales, ...props }: {
    locales?: string[];
    [key: string]: any;
}): React__default.JSX.Element | null;

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cdn.gtx.dev'] - The URL of the cache service for fetching translations.
 * @param {string} [runtimeUrl='https://runtime.gtx.dev'] - The URL of the runtime service for fetching translations.
 * @param {RenderSettings} [renderSettings=defaultRenderSettings] - The settings for rendering translations.
 * @param {string} [_versionId] - The version ID for fetching translations.
 * @param {string} [devApiKey] - The API key for development environments.
 * @param {object} [metadata] - Additional metadata to pass to the context.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
declare function GTProvider({ children, projectId: _projectId, devApiKey: _devApiKey, dictionary: _dictionary, locales, defaultLocale, locale: _locale, cacheUrl, runtimeUrl, renderSettings, loadMessages, loadTranslations, _versionId, ...metadata }: {
    children?: React__default.ReactNode;
    projectId?: string;
    devApiKey?: string;
    dictionary?: any;
    locales?: string[];
    defaultLocale?: string;
    locale?: string;
    cacheUrl?: string;
    runtimeUrl?: string;
    renderSettings?: {
        method: RenderMethod;
        timeout?: number;
    };
    loadMessages?: CustomLoader;
    loadTranslations?: CustomLoader;
    _versionId?: string;
    [key: string]: any;
}): React__default.JSX.Element;

/**
 * Sets the user's locale in the `<GTProvider>` context.
 * If the locale passed is not supported, will fallback on current locale and then defaultLocale if necessary.
 * @note Unless a locale has explicitly been passed to the `<GTProvider>`, this will override the user's browser preferences. The locale passed to `<GTProvider>` will always take priority.
 *
 * @returns {(locale: string) => void} A function that sets the user's locale.
 *
 * @example
 * setLocale('en-US');
 */
declare function useSetLocale(): (locale: string) => void;

/**
 * Retrieves the user's list of supported locales from the `<GTProvider>` context.
 *
 * @returns {string[]} The user's locales, e.g., ['en-US', 'fr', 'jp'].
 *
 * @example
 * const locales = useLocales();
 * console.log(locale); // ['en-US', 'fr', 'jp]
 */
declare function useLocales(): string[];

/**
 * Gets the list of properties for using a locale selector.
 * @param locales an optional list of locales to use for the drop down. These locales must be a subset of the locales provided by the `<GTProvider>` context. When not provided, the list of locales from the `<GTProvider>` context is used.
 * @returns {object} The locale, locales, and setLocale function.
 */
declare function useLocaleSelector(locales?: string[]): {
    locale: string;
    locales: string[];
    setLocale: (locale: string) => void;
};

export { Branch, ClientProvider, Currency, DateTime, GTContext, GTProvider, LocaleSelector, Num, Plural, T, Var, renderVariable, useDefaultLocale, useDict, useGT, useLocale, useLocaleSelector, useLocales, useRuntimeTranslation, useSetLocale };
