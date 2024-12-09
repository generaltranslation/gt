"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUnsupportedLocalesWarning = exports.createNoEntryWarning = exports.usingDefaultsWarning = exports.createAdvancedFunctionsError = exports.createRequiredPrefixError = exports.createStringTranslationError = exports.renderingError = exports.remoteTranslationsError = exports.APIKeyMissingError = exports.projectIdMissingError = void 0;
var generaltranslation_1 = require("generaltranslation");
exports.projectIdMissingError = 'General Translation: Project ID missing! Set projectId as GT_PROJECT_ID in the environment or by passing the projectId parameter to initGT(). Find your project ID: www.generaltranslation.com/dashboard.';
exports.APIKeyMissingError = 'General Translation: API key is required for automatic translation! Create an API key: www.generaltranslation.com/dashboard/api-keys. (Or, turn off automatic translation by setting baseURL to an empty string.)';
exports.remoteTranslationsError = 'General Translation: Error fetching remote translation.';
exports.renderingError = 'General Translation: Rendering error.';
var createStringTranslationError = function (content, id) { return "gt-next string translation error. tx(\"".concat(content, "\")").concat(id ? " with id \"".concat(id, "\"") : '', " failed."); };
exports.createStringTranslationError = createStringTranslationError;
var createRequiredPrefixError = function (id, requiredPrefix) {
    return "You are using <GTProvider> with a provided prefix id: \"".concat(requiredPrefix, "\", but one of the children of <GTProvider> has the id \"").concat(id, "\". Change the <GTProvider> id prop or your dictionary structure to proceed.");
};
exports.createRequiredPrefixError = createRequiredPrefixError;
var createAdvancedFunctionsError = function (id, options) {
    return "General Translation: You're trying to call a function in the server dictionary on the client-side, but functions can't be passed directly from server to client. " +
        "Try including the function you want to call as a parameter in t(), like t(\"".concat(id, "\", ").concat(options ? JSON.stringify(options) : 'undefined', ", MyFunction)");
};
exports.createAdvancedFunctionsError = createAdvancedFunctionsError;
// ---- WARNINGS ---- //
exports.usingDefaultsWarning = 'General Translation: Unable to access gt-next configuration. Using defaults.';
var createNoEntryWarning = function (id) { return "gt-next: No dictionary entry found for id: \"".concat(id, "\""); };
exports.createNoEntryWarning = createNoEntryWarning;
var createUnsupportedLocalesWarning = function (locales) { return "General Translation: The following locales are currently unsupported by our service: ".concat(locales.map(function (locale) {
    var name = (0, generaltranslation_1.getLocaleProperties)(locale).name;
    return "".concat(locale, " (").concat(name, ")");
}).join(', ')); };
exports.createUnsupportedLocalesWarning = createUnsupportedLocalesWarning;
//# sourceMappingURL=createErrors.js.map