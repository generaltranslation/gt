"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoEntryWarning = exports.usingDefaultsWarning = exports.createAdvancedFunctionsError = exports.createRequiredPrefixError = exports.createStringTranslationError = exports.renderingError = exports.remoteTranslationsError = exports.APIKeyMissingError = exports.projectIDMissingError = void 0;
exports.projectIDMissingError = 'General Translation: Project ID missing! Set projectID as GT_PROJECT_ID in the environment or by passing the projectID parameter to initGT(). Find your project ID: www.generaltranslation.com/dashboard.';
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
//# sourceMappingURL=createErrors.js.map