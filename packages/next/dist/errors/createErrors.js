"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.noInitGTWarn = exports.projectIdMissingWarn = exports.createMismatchingHashWarning = exports.createUnsupportedLocalesWarning = exports.createNoEntryWarning = exports.usingDefaultsWarning = exports.APIKeyMissingError = exports.createMissingCustomTranslationLoadedError = exports.createDictionarySubsetError = exports.devApiKeyIncludedInProductionError = exports.createRequiredPrefixError = exports.createDictionaryStringTranslationError = exports.createStringTranslationError = exports.localTranslationsError = exports.remoteTranslationsError = void 0;
var generaltranslation_1 = require("generaltranslation");
exports.remoteTranslationsError = 'General Translation: Error fetching remote translation.';
exports.localTranslationsError = 'General Translation: Error fetching locally stored translation.';
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
var createMissingCustomTranslationLoadedError = function (customTranslationLoaderPath) {
    return customTranslationLoaderPath
        ? "Local translations exist, but no translation loader is found. Please create a translation loader at ".concat(customTranslationLoaderPath)
        : 'Local translations exist, but no translation loader is found. See generaltranslation.com/docs for more information on how to create a translation loader.';
};
exports.createMissingCustomTranslationLoadedError = createMissingCustomTranslationLoadedError;
exports.APIKeyMissingError = "General Translation Error: \n  An Development API key is required for runtime translation!\n  Find your Development API key: generaltranslation.com/dashboard\n  For more information, visit generaltranslation.com/docs\n  \n  (Or, disable this error message by setting runtimeUrl to an empty string which disables runtime translation.)";
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
exports.projectIdMissingWarn = "General Translation Warning: Project ID missing!\n  Set projectId as GT_PROJECT_ID in your environment or by passing the projectId parameter to initGT().\n  Find your project ID: generaltranslation.com/dashboard.\n  \n  (Hint: if you want to use runtime translation, you need to add both GT_PROJECT_ID and GT_API_KEY to your environment.)";
exports.noInitGTWarn = "General Translation Warning:\n  You are running General Translation without the initGT() plugin.\n  This means that you are not translating your app.\n  \n  To activate translation, add the initGT() plugin to your app, and set the projectId and apiKey in your environment.\n  For more information, visit https://generaltranslation.com/docs/next/tutorials/quickstart";
//# sourceMappingURL=createErrors.js.map