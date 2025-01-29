import { ReactNode, ReactElement } from "react";
export type Entry = string | ReactElement | ((params: any) => ReactNode);
export type Metadata = {
    singular?: Entry;
    plural?: Entry;
    zero?: Entry;
    dual?: Entry;
    one?: Entry;
    two?: Entry;
    few?: Entry;
    many?: Entry;
    other?: Entry;
    variableOptions?: Record<string, any>;
    [key: string]: any;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, Metadata];
export type Dictionary = {
    [key: string]: Dictionary | DictionaryEntry;
};
//# sourceMappingURL=isValidDictionaryEntry.d.ts.map