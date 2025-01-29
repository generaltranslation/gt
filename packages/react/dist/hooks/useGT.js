"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useGT;
var GTContext_1 = __importDefault(require("../provider/GTContext"));
var createMessages_1 = require("../messages/createMessages");
/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
function useGT(id) {
    if (id === void 0) { id = ''; }
    // Create a prefix for translation keys if an id is provided
    var getId = function (suffix) {
        return id ? "".concat(id, ".").concat(suffix) : suffix;
    };
    // Get the translation context
    var translateDictionaryEntry = (0, GTContext_1.default)("useGT('".concat(id, "'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.")).translateDictionaryEntry;
    /**
    * Translates a dictionary item based on its `id` and options.
    *
    * @param {string} [id=''] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    *
    * @returns {React.ReactNode}
    */
    function t(id, options) {
        if (id === void 0) { id = ''; }
        if (options === void 0) { options = {}; }
        var prefixedId = getId(id);
        if (translateDictionaryEntry) {
            var translation = translateDictionaryEntry(prefixedId, options);
            if (translation === undefined || translation === null)
                console.warn((0, createMessages_1.createNoEntryWarning)(id, prefixedId));
            return translation;
        }
    }
    ;
    return t;
}
//# sourceMappingURL=useGT.js.map