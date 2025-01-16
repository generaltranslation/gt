import { getDictionaryEntry as getEntry } from "gt-react/internal";
var dictionary;
export default function getDictionary() {
    if (dictionary)
        return dictionary;
    try {
        dictionary = require('gt-next/_dictionary').default;
    }
    catch (error) {
        dictionary = {};
    }
    return dictionary;
}
export function getDictionaryEntry(id) {
    var obj = getDictionary();
    return getEntry(obj, id);
}
//# sourceMappingURL=getDictionary.js.map