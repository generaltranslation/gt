import { getDictionaryEntry as getEntry } from "gt-react/internal";

let dictionary: Record<string, any>;

export default function getDictionary() {
    if (dictionary) return dictionary;
    try {
        dictionary = require('gt-next/_dictionary').default;
    } catch (error) {
        dictionary = {};
    }
    return dictionary;
}

export function getDictionaryEntry(id: string) {
    const obj = getDictionary();
    return getEntry(obj, id);
}