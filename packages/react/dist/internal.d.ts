import React, { ReactElement, ReactNode } from 'react';
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
type TaggedEntry = string | TaggedChildren;
type TaggedDictionaryEntry = TaggedEntry | [TaggedEntry] | [TaggedEntry, Metadata];
type TaggedDictionary = {
    [key: string]: TaggedDictionary | TaggedDictionaryEntry;
};
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
    [key: string]: TranslationSuccess | TranslationLoading | TranslationError;
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
    translateDictionaryEntry: (id: string, options?: Record<string, any>) => React.ReactNode;
    translateContent: TranslateContentCallback;
    translateChildren: TranslateChildrenCallback;
    locale: string;
    locales: string[];
    setLocale: (locale: string) => void;
    defaultLocale: string;
    translations: TranslationsObject | null;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
    translationEnabled: boolean;
    runtimeTranslationEnabled: boolean;
};
declare class GTTranslationError extends Error {
    error: string;
    code: number;
    constructor(error: string, code: number);
    toTranslationError(): TranslationError;
}
type ClientProviderProps = {
    children: any;
    dictionary: FlattenedTaggedDictionary;
    initialTranslations: TranslationsObject;
    translationPromises: Record<string, Promise<TranslatedChildren>>;
    locale: string;
    locales: string[];
    _versionId?: string;
    dictionaryEnabled?: boolean;
    defaultLocale: string;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    requiredPrefix: string | undefined;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    translationEnabled: boolean;
    runtimeTranslationEnabled: boolean;
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string | null;
    onLocaleChange?: () => void;
    cookieName?: string;
};

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

declare function getDictionaryEntry<T extends Dictionary | FlattenedDictionary>(dictionary: T, id: string): T extends FlattenedDictionary ? DictionaryEntry | undefined : Dictionary | DictionaryEntry | undefined;

declare function extractEntryMetadata(value: DictionaryEntry | TaggedDictionaryEntry): {
    entry: Entry | TaggedEntry;
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
    timeout?: number;
};

/**
 * renderSkeleton is a function that handles the rendering behavior for the skeleton loading method.
 * It replaces all content with empty strings
 * @returns an empty string
 */
declare function renderSkeleton(): React.ReactNode;

declare function isEmptyReactFragment(target: unknown): target is React.ReactElement;

export { type Child, type Children, type ClientProviderProps, type Dictionary, type DictionaryEntry, type Entry, type FlattenedDictionary, type FlattenedTaggedDictionary, type GTContextType, type GTProp, GTTranslationError, type Metadata, type RenderMethod, type TaggedChildren, type TaggedDictionary, type TaggedDictionaryEntry, type TaggedEntry, type TranslatedChildren, type TranslatedContent, type TranslationError, type TranslationLoading, type TranslationSuccess, type TranslationsObject, addGTIdentifier, defaultRenderSettings, extractEntryMetadata, flattenDictionary, getDictionaryEntry, getFallbackVariableName, getPluralBranch, getVariableName, getVariableProps, isEmptyReactFragment, isVariableObject, renderDefaultChildren, renderSkeleton, renderTranslatedChildren, writeChildrenAsObjects };
