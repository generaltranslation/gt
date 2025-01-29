"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useDefaultLocale;
var GTContext_1 = __importDefault(require("../provider/GTContext"));
/**
 * Retrieves the application's default locale from the `<GTProvider>` context.
 *
 * If no default locale is passed to the `<GTProvider>`, it defaults to providing 'en'.
 *
 * @returns {string} The application's default locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useDefaultLocale();
 * console.log(locale); // 'en-US'
 */
function useDefaultLocale() {
    return (0, GTContext_1.default)("useDefaultLocale(): Unable to access default locale outside of a <GTProvider>").defaultLocale;
}
//# sourceMappingURL=useDefaultLocale.js.map