export declare const remoteTranslationsError = "gt-next Error: fetching remote translation.";
export declare const customLoadTranslationError = "gt-next Error: fetching locally stored translations. If you are using a custom loadTranslation(), make sure it is correctly implemented.";
export declare const createStringTranslationError: (content: string, id?: string, functionName?: string) => string;
export declare const createDictionaryStringTranslationError: (id: string) => string;
export declare const createRequiredPrefixError: (id: string, requiredPrefix: string) => string;
export declare const devApiKeyIncludedInProductionError = "gt-next Error: You are attempting a production using a development API key. Replace this API key with a production API key when you build your app for production.";
export declare const createDictionarySubsetError: (id: string, functionName: string) => string;
export declare const createMissingCustomTranslationLoadedError: (customLoadTranslationPath: string | undefined) => string;
export declare const dictionaryDisabledError = "gt-next Error: You are trying to use a dictionary, but you have not added the withGTConfig() plugin to your app. You must add withGTConfig() to use dictionaries. For more information, visit generaltranslation.com/docs";
export declare const unresolvedCustomLoadTranslationError = "gt-next Error: Custom translation loader could not be resolved. This usually means that the file was found, but the translation loader function itself was not exported.";
export declare const usingDefaultsWarning = "gt-next: Unable to access gt-next configuration. Using defaults.";
export declare const createNoEntryWarning: (id: string) => string;
export declare const createUnsupportedLocalesWarning: (locales: string[]) => string;
export declare const createMismatchingHashWarning: (expectedHash: string, receivedHash: string) => string;
export declare const projectIdMissingWarn = "gt-next: Project ID missing! Set projectId as GT_PROJECT_ID in your environment or by passing the projectId parameter to withGTConfig(). Find your project ID: generaltranslation.com/dashboard.";
export declare const noInitGTWarn: string;
export declare const APIKeyMissingWarn: string;
export declare const translationLoadingWarningLittleT: string;
//# sourceMappingURL=createErrors.d.ts.map