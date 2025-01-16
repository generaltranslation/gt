// ---- ERRORS ---- //
import { getLocaleProperties } from "generaltranslation";
export var projectIdMissingError = 'General Translation: Project ID missing! Set projectId as GT_PROJECT_ID in the environment or by passing the projectId parameter to initGT(). Find your project ID: www.generaltranslation.com/dashboard.';
export var APIKeyMissingError = 'General Translation: API key is required for runtime translation! Create an API key: www.generaltranslation.com/dashboard/api-keys. (Or, turn off runtime translation by setting runtimeUrl to an empty string.)';
export var remoteTranslationsError = 'General Translation: Error fetching remote translation.';
export var renderingError = 'General Translation: Rendering error.';
export var createStringTranslationError = function (content, id) { return "gt-next string translation error. tx(\"".concat(content, "\")").concat(id ? " with id \"".concat(id, "\"") : '', " failed."); };
export var createRequiredPrefixError = function (id, requiredPrefix) {
    return "You are using <GTProvider> with a provided prefix id: \"".concat(requiredPrefix, "\", but one of the children of <GTProvider> has the id \"").concat(id, "\". Change the <GTProvider> id prop or your dictionary structure to proceed.");
};
export var devApiKeyIncludedInProductionError = "General Translation: You are attempting a production build of your app with a developer API key (beginning \"gtx-dev-\"). Replace this API key with a production API key (beginning \"gtx-api-\") when you build your app for production.";
export var createDictionarySubsetError = function (id, functionName) {
    return "General Translation: ".concat(functionName, " with id: \"").concat(id, "\". Invalid dictionary entry detected. Make sure you are navigating to the correct subroute of the dictionary with the ID you provide.");
};
// ---- WARNINGS ---- //
export var usingDefaultsWarning = 'General Translation: Unable to access gt-next configuration. Using defaults.';
export var createNoEntryWarning = function (id) { return "gt-next: No dictionary entry found for id: \"".concat(id, "\""); };
export var createUnsupportedLocalesWarning = function (locales) { return "General Translation: The following locales are currently unsupported by our service: ".concat(locales.map(function (locale) {
    var name = getLocaleProperties(locale).name;
    return "".concat(locale, " (").concat(name, ")");
}).join(', ')); };
//# sourceMappingURL=createErrors.js.map