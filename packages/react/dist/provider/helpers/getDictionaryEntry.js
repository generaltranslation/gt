"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getDictionaryEntry;
const react_1 = __importDefault(require("react"));
const createMessages_1 = require("../../messages/createMessages");
function getDictionaryEntry(dictionary, id) {
    let current = dictionary;
    let dictionaryPath = id.split(".");
    for (const key of dictionaryPath) {
        if (typeof current !== "object" ||
            Array.isArray(current) ||
            react_1.default.isValidElement(current)) {
            console.error((0, createMessages_1.createLibraryNoEntryWarning)(id));
            return undefined;
        }
        current = current[key];
    }
    return current;
}
//# sourceMappingURL=getDictionaryEntry.js.map