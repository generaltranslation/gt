import React, { ReactNode } from 'react';
import { JsxChildren } from 'generaltranslation/internal';

type Child = React.ReactNode;
type Children = Child[] | Child;
type GTProp = {
    id: number;
    transformation?: string;
    children?: Children;
} & Record<string, any>;
type TaggedChild = React.ReactNode | TaggedElement;
type TaggedChildren = TaggedChild[] | TaggedChild;
type TaggedElementProps = Record<string, any> & {
    'data-_gt': GTProp;
};
type TaggedElement = React.ReactElement<TaggedElementProps>;
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
type FlattenedDictionary = {
    [key: string]: DictionaryEntry;
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
type LocalesMessages = {
    [locale: string]: MessagesObject;
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
type RuntimeTranslationOptions = {
    locale?: string;
} & InlineTranslationOptions;
declare class GTTranslationError extends Error {
    error: string;
    code: number;
    constructor(error: string, code: number);
    toTranslationError(): TranslationError;
}

/**
 * Flattens a nested dictionary by concatenating nested keys.
 * Throws an error if two keys result in the same flattened key.
 * @param {Record<string, any>} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {Record<string, React.ReactNode>} The flattened dictionary object.
 * @throws {Error} If two keys result in the same flattened key.
 */
declare function flattenDictionary(dictionary: Dictionary, prefix?: string): FlattenedDictionary;

declare function addGTIdentifier(children: Children, startingIndex?: number): TaggedChildren;

/**
 * Transforms children elements into objects, processing each child recursively if needed.
 * @param {Children} children - The children to process.
 * @returns {object} The processed children as objects.
 */
declare function writeChildrenAsObjects(children: TaggedChildren): JsxChildren;

/**
 * Main function to get the appropriate branch based on the provided number and branches.
 *
 * @param {number} n - The number to determine the branch for.
 * @param {any} branches - The object containing possible branches.
 * @returns {any} The determined branch.
 */
declare function getPluralBranch(n: number, locales: string[], branches: Record<string, any>): any;

declare function isValidDictionaryEntry(value: unknown): value is DictionaryEntry;
declare function getDictionaryEntry<T extends Dictionary>(dictionary: T, id: string): Dictionary | DictionaryEntry | undefined;

declare function getEntryAndMetadata(value: DictionaryEntry): {
    entry: string;
    metadata?: Metadata;
};

declare function getVariableProps(props: {
    'data-_gt'?: {
        transformation: 'variable';
        [key: string]: any;
    };
    [key: string]: any;
}): {
    variableName: string;
    variableType: "number" | "variable" | "datetime" | "currency";
    variableValue?: any;
    variableOptions?: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
};

declare function isVariableObject(obj: unknown): obj is Variable;

declare function getFallbackVariableName(variableType?: string): string;
declare function getVariableName(props: Record<string, any> | undefined, variableType: string): string;

declare function renderDefaultChildren({ children, variables, variablesOptions, defaultLocale, renderVariable, }: {
    children: ReactNode;
    variables?: Record<string, any>;
    variablesOptions?: Record<string, any>;
    defaultLocale: string;
    renderVariable: ({ variableType, variableName, variableValue, variableOptions, }: {
        variableType: 'variable' | 'number' | 'datetime' | 'currency';
        variableName: string;
        variableValue: any;
        variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
        locales: string[];
    }) => React.JSX.Element;
}): React.ReactNode;

declare function renderTranslatedChildren({ source, target, variables, variablesOptions, locales, renderVariable, }: {
    source: ReactNode;
    target: TranslatedChildren;
    variables?: Record<string, any>;
    variablesOptions?: Record<string, any>;
    locales: string[];
    renderVariable: ({ variableType, variableName, variableValue, variableOptions, }: {
        variableType: 'variable' | 'number' | 'datetime' | 'currency';
        variableName: string;
        variableValue: any;
        variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
        locales: string[];
    }) => React.JSX.Element;
}): ReactNode;

declare const defaultRenderSettings: {
    method: RenderMethod;
    timeout: number;
};

/**
 * renderSkeleton is a function that handles the rendering behavior for the skeleton loading method.
 * It replaces all content with empty strings
 * @returns an empty string
 */
declare function renderSkeleton(): React.ReactNode;

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

export { type Child, type Children, type ClientProviderProps, type CustomLoader, type Dictionary, type DictionaryEntry, type DictionaryTranslationOptions, type Entry, type FlattenedDictionary, type GTContextType, type GTProp, GTTranslationError, type InlineTranslationOptions, type LocalesMessages, type MessagesContent, type MessagesObject, type Metadata, type RenderMethod, type RuntimeTranslationOptions, type TranslatedChildren, type TranslatedContent, type TranslationError, type TranslationLoading, type TranslationSuccess, type TranslationsObject, addGTIdentifier, defaultRenderSettings, flattenDictionary, getDictionaryEntry, getEntryAndMetadata, getFallbackVariableName, getPluralBranch, getVariableName, getVariableProps, isValidDictionaryEntry, isVariableObject, renderDefaultChildren, renderSkeleton, renderTranslatedChildren, writeChildrenAsObjects };
