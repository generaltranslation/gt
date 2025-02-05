"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMismatchingIdHashWarning = exports.createMismatchingHashWarning = exports.createUnsupportedLocalesWarning = exports.createNoEntryWarning = exports.usingDefaultsWarning = exports.createDictionarySubsetError = exports.devApiKeyIncludedInProductionError = exports.createRequiredPrefixError = exports.createDictionaryStringTranslationError = exports.createStringTranslationError = exports.remoteTranslationsError = exports.APIKeyMissingError = exports.projectIdMissingError = void 0;
var generaltranslation_1 = require("generaltranslation");
exports.projectIdMissingError = 'General Translation: Project ID missing! Set projectId as GT_PROJECT_ID in the environment or by passing the projectId parameter to initGT(). Find your project ID: generaltranslation.com/dashboard.';
exports.APIKeyMissingError = 'General Translation: API key is required for runtime translation! Create an API key: generaltranslation.com/dashboard/api-keys. (Or, turn off runtime translation by setting runtimeUrl to an empty string.)';
exports.remoteTranslationsError = 'General Translation: Error fetching remote translation.';
var createStringTranslationError = function (content, id) {
    return "gt-next string translation error. tx(\"".concat(content, "\")").concat(id ? " with id \"".concat(id, "\"") : '', " failed.");
};
exports.createStringTranslationError = createStringTranslationError;
var createDictionaryStringTranslationError = function (id) {
    return "gt-next string translation error. Translation from dictionary with id: ".concat(id, " failed.");
};
exports.createDictionaryStringTranslationError = createDictionaryStringTranslationError;
var createRequiredPrefixError = function (id, requiredPrefix) {
    return "You are using <GTProvider> with a provided prefix id: \"".concat(requiredPrefix, "\", but one of the children of <GTProvider> has the id \"").concat(id, "\". Change the <GTProvider> id prop or your dictionary structure to proceed.");
};
exports.createRequiredPrefixError = createRequiredPrefixError;
exports.devApiKeyIncludedInProductionError = "General Translation: You are attempting a production using a development API key. Replace this API key with a production API key when you build your app for production.";
var createDictionarySubsetError = function (id, functionName) {
    return "General Translation: ".concat(functionName, " with id: \"").concat(id, "\". Invalid dictionary entry detected. Make sure you are navigating to the correct subroute of the dictionary with the ID you provide.");
};
exports.createDictionarySubsetError = createDictionarySubsetError;
// ---- WARNINGS ---- //
exports.usingDefaultsWarning = 'General Translation: Unable to access gt-next configuration. Using defaults.';
var createNoEntryWarning = function (id) {
    return "gt-next: No dictionary entry found for id: \"".concat(id, "\"");
};
exports.createNoEntryWarning = createNoEntryWarning;
var createUnsupportedLocalesWarning = function (locales) {
    return "General Translation: The following locales are currently unsupported by our service: ".concat(locales
        .map(function (locale) {
        var name = (0, generaltranslation_1.getLocaleProperties)(locale).name;
        return "".concat(locale, " (").concat(name, ")");
    })
        .join(', '));
};
exports.createUnsupportedLocalesWarning = createUnsupportedLocalesWarning;
var createMismatchingHashWarning = function (expectedHash, receivedHash) {
    return "gt-next: Mismatching hashes! Expected hash: ".concat(expectedHash, ", but got hash: ").concat(receivedHash, ". We will still render your translation, but make sure to update to the newest version: generaltranslation.com/docs");
};
exports.createMismatchingHashWarning = createMismatchingHashWarning;
var createMismatchingIdHashWarning = function (expectedId, expectedHash, receivedId, receivedHash) {
    return "gt-next: Mismatching ids or hashes! Expected id: ".concat(expectedId, ", hash: ").concat(expectedHash, ", but got id: ").concat(receivedId, ", hash: ").concat(receivedHash, ". We will still render your translation, but make sure to update to the newest version: generaltranslation.com/docs");
};
exports.createMismatchingIdHashWarning = createMismatchingIdHashWarning;
//# sourceMappingURL=createErrors.js.map