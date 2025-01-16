import { TranslatedChildren, TranslatedContent, TranslationError } from "gt-react/internal";
export type TranslationPromise = {
    promise: Promise<TranslatedChildren> | Promise<TranslatedContent>;
    hash: string;
    type: 'jsx' | 'content';
};
export type Translations = {
    [id: string]: {
        [hash: string]: TranslatedChildren | TranslatedContent;
    } | TranslationError | TranslationPromise;
};
export declare class GTTranslationError extends Error {
    error: string;
    code: number;
    constructor(error: string, code: number);
    toTranslationError(): TranslationError;
}
//# sourceMappingURL=types.d.ts.map