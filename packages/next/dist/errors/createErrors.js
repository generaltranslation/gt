"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.dictionaryNotFoundWarning = exports.runtimeTranslationTimeoutWarning = exports.translationLoadingWarning = exports.APIKeyMissingWarn = exports.noInitGTWarn = exports.projectIdMissingWarn = exports.createMismatchingHashWarning = exports.createUnsupportedLocalesWarning = exports.createInvalidDictionaryEntryWarning = exports.createNoEntryFoundWarning = exports.usingDefaultsWarning = exports.unresolvedCustomLoadMessagesError = exports.unresolvedCustomLoadTranslationError = exports.dictionaryDisabledError = exports.createDictionarySubsetError = exports.devApiKeyIncludedInProductionError = exports.createRequiredPrefixError = exports.createDictionaryStringTranslationError = exports.createStringTranslationError = exports.customLoadMessagesWarning = exports.customLoadTranslationError = exports.remoteTranslationsError = void 0;
var generaltranslation_1 = require("generaltranslation");
exports.remoteTranslationsError = 'gt-next Error: fetching remote translation.';
var customLoadTranslationError = function (locale) {
    if (locale === void 0) { locale = ''; }
    return "gt-next Error: fetching locally stored translations. If you are using a custom loadTranslation(".concat(locale, "), make sure it is correctly implemented.");
};
exports.customLoadTranslationError = customLoadTranslationError;
var customLoadMessagesWarning = function (locale) {
    if (locale === void 0) { locale = ''; }
    return "gt-next Warning: fetching locally stored messages. If you are using a custom loadMessage(".concat(locale, "), make sure it is correctly implemented.");
};
exports.customLoadMessagesWarning = customLoadMessagesWarning;
var createStringTranslationError = function (string, id, functionName) {
    if (functionName === void 0) { functionName = 'tx'; }
    return "gt-next string translation error. ".concat(functionName, "(\"").concat(string, "\")").concat(id ? " with id \"".concat(id, "\"") : '', " could not locate translation.");
};
exports.createStringTranslationError = createStringTranslationError;
var createDictionaryStringTranslationError = function (id) {
    return "gt-next Error: string translation error. Translation from dictionary with id: ".concat(id, " failed.");
};
exports.createDictionaryStringTranslationError = createDictionaryStringTranslationError;
var createRequiredPrefixError = function (id, requiredPrefix) {
    return "gt-next Error: You are using <GTProvider> with a provided prefix id: \"".concat(requiredPrefix, "\", but one of the children of <GTProvider> has the id \"").concat(id, "\". Change the <GTProvider> id prop or your dictionary structure to proceed.");
};
exports.createRequiredPrefixError = createRequiredPrefixError;
exports.devApiKeyIncludedInProductionError = "gt-next Error: You are attempting a production using a development API key. Replace this API key with a production API key when you build your app for production.";
var createDictionarySubsetError = function (id, functionName) {
    return "gt-next Error: ".concat(functionName, " with id: \"").concat(id, "\". Invalid dictionary entry detected. Make sure you are navigating to the correct subroute of the dictionary with the ID you provide.");
};
exports.createDictionarySubsetError = createDictionarySubsetError;
exports.dictionaryDisabledError = "gt-next Error: You are trying to use a dictionary, but you have not added the withGTConfig() plugin to your app. You must add withGTConfig() to use dictionaries. For more information, visit generaltranslation.com/docs";
exports.unresolvedCustomLoadTranslationError = "gt-next Error: Custom translation loader could not be resolved. This usually means that the file was found, but the translation loader function itself was not exported.";
exports.unresolvedCustomLoadMessagesError = "gt-next Error: Custom message loader could not be resolved. This usually means that the file was found, but the message loader function itself was not exported.";
// ---- WARNINGS ---- //
exports.usingDefaultsWarning = 'gt-next: Unable to access gt-next configuration. Using defaults.';
var createNoEntryFoundWarning = function (id) {
    return "gt-next: No valid dictionary entry found for id: \"".concat(id, "\"");
};
exports.createNoEntryFoundWarning = createNoEntryFoundWarning;
var createInvalidDictionaryEntryWarning = function (id) {
    return "gt-next: Invalid dictionary entry found for id: \"".concat(id, "\"");
};
exports.createInvalidDictionaryEntryWarning = createInvalidDictionaryEntryWarning;
var createUnsupportedLocalesWarning = function (locales) {
    return "gt-next: The following locales are currently unsupported by our service: ".concat(locales
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
exports.projectIdMissingWarn = "gt-next: Project ID missing! Set projectId as GT_PROJECT_ID in your environment or by passing the projectId parameter to withGTConfig(). Find your project ID: generaltranslation.com/dashboard.";
exports.noInitGTWarn = "gt-next: You are running General Translation without the withGTConfig() plugin. " +
    "This means that you are not translating your app. To activate translation, add the withGTConfig() plugin to your app, " +
    "and set the projectId and apiKey in your environment. " +
    "For more information, visit https://generaltranslation.com/docs/next/tutorials/quickstart";
exports.APIKeyMissingWarn = "gt-next: A Development API key is required for runtime translation!  " +
    "Find your Development API key: generaltranslation.com/dashboard.  " +
    "(Or, disable this warning message by setting runtimeUrl to an empty string which disables runtime translation.)";
exports.translationLoadingWarning = "gt-next: [DEV ONLY] Translations have changed since the last update. " +
    "Translations in production will be preloaded, and page will not need to be refreshed.";
exports.runtimeTranslationTimeoutWarning = "gt-next: Runtime translation timed out.";
exports.dictionaryNotFoundWarning = "gt-next: Dictionary not found. Make sure you have added a dictionary to your project (either dictionary.js or /messages/[defaultLocale].json), and you have added the withGTConfig() plugin.";
//# sourceMappingURL=createErrors.js.map