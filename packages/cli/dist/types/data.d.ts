export type Entry = string;
export type DictionaryMetadata = {
    context?: string;
    variablesOptions?: Record<string, any>;
    [key: string]: any;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, DictionaryMetadata];
export type Dictionary = {
    [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
    [key: string]: DictionaryEntry;
};
export type JSONDictionary = {
    [key: string]: string | JSONDictionary;
};
export type FlattenedJSONDictionary = {
    [key: string]: string;
};
export type DataFormat = 'JSX' | 'ICU' | 'I18NEXT';
export type FileExtension = 'json' | 'yaml' | 'yml' | 'mdx' | 'md';
export type FileFormats = 'JSON' | 'YAML' | 'MDX' | 'MD';
export type JsxChildren = string | string[] | any;
export type Translations = {
    [key: string]: JsxChildren;
};
export type TranslationsMetadata = {
    [key: string]: {
        id?: string;
        hash?: string;
    };
};
