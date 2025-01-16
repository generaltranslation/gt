"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getDictionary;
exports.getDictionaryEntry = getDictionaryEntry;
var internal_1 = require("gt-react/internal");
var dictionary;
function getDictionary() {
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
function getDictionaryEntry(id) {
    var obj = getDictionary();
    return (0, internal_1.getDictionaryEntry)(obj, id);
}
//# sourceMappingURL=getDictionary.js.map