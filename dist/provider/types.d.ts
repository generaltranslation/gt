import { ReactNode } from "react";
export type ClientDictionaryEntry = ReactNode;
export type ClientDictionaryEntryWithOptionalMetadata = ClientDictionaryEntry | [ClientDictionaryEntry, {
    [key: string]: any;
    isFunction?: boolean;
}];
export type ClientDictionary = {
    [key: string]: ClientDictionaryEntryWithOptionalMetadata;
};
export type ClientTranslations = {
    [key: string]: any | // a translation
    string | {
        promise: Promise<any>;
        loadingFallback: any;
        errorFallback: any;
    };
};
//# sourceMappingURL=types.d.ts.map