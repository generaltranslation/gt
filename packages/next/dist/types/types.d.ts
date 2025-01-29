import { TaggedChildren, TranslationError, Metadata } from 'gt-react/internal';
export type TaggedEntry = string | TaggedChildren;
export type TaggedDictionaryEntry = TaggedEntry | [TaggedEntry] | [TaggedEntry, Metadata];
export type TaggedDictionary = {
    [key: string]: TaggedDictionary | TaggedDictionaryEntry;
};
export type FlattenedTaggedDictionary = {
    [key: string]: TaggedDictionaryEntry;
};
export declare class GTTranslationError extends Error {
    error: string;
    code: number;
    constructor(error: string, code: number);
    toTranslationError(): TranslationError;
}
//# sourceMappingURL=types.d.ts.map