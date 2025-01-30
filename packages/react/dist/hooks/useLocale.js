"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useLocale;
const GTContext_1 = __importDefault(require("../provider/GTContext"));
/**
 * Retrieves the user's locale from the `<GTProvider>` context.
 *
 * @returns {string} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useLocale();
 * console.log(locale); // 'en-US'
 */
function useLocale() {
    return (0, GTContext_1.default)("useLocale(): Unable to access user's locale outside of a <GTProvider>").locale;
}
//# sourceMappingURL=useLocale.js.map