export type Entry = string;
export type Metadata = {
    context?: string;
    variablesOptions?: Record<string, any>;
    [key: string]: any;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, Metadata];
export type Dictionary = {
    [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
    [key: string]: DictionaryEntry;
};
