"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getDictionary;
exports.getDictionaryEntry = getDictionaryEntry;
var internal_1 = require("gt-react/internal");
var createErrors_1 = require("../errors/createErrors");
var dictionary = undefined;
function getDictionary() {
    if (dictionary !== undefined)
        return dictionary;
    try {
        var dictionaryFileType = process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;
        if (dictionaryFileType === '.json') {
            dictionary = require('gt-next/_dictionary');
        }
        else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
            dictionary = require('gt-next/_dictionary').default;
        }
        else {
            console.warn(createErrors_1.dictionaryNotFoundWarning);
            dictionary = {};
        }
    }
    catch (_a) {
        dictionary = {};
    }
    return dictionary;
}
function getDictionaryEntry(id) {
    var obj = getDictionary();
    if (!obj)
        return undefined;
    return (0, internal_1.getDictionaryEntry)(obj, id);
}
//# sourceMappingURL=getDictionary.js.map