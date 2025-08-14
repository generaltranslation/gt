// ---- ERRORS ---- //

import { getLocaleProperties } from 'generaltranslation';

export const remoteTranslationsError =
  'gt-next Error: fetching remote translation.';

export const customLoadTranslationsError = (locale: string = '') =>
  `gt-next Error: fetching locally stored translations. If you are using a custom loadTranslations("${locale}"), make sure it is correctly implemented.`;

export const customLoadDictionaryWarning = (locale: string = '') =>
  `gt-next Warning: fetching locally stored translation dictionary. If you are using a custom loadDictionary("${locale}"), make sure it is correctly implemented.`;

export const createUnresolvedNextVersionError = (error: Error) =>
  `gt-next Error: Unable to resolve next version. ${error.message}`;

export const createStringTranslationError = (
  string: string,
  id?: string,
  functionName = 'tx'
) =>
  `gt-next string translation error. ${functionName}("${string}")${
    id ? ` with id "${id}"` : ''
  } could not locate translation.`;

export const createDictionaryTranslationError = (id: string) =>
  `gt-next Error: Dictionary translation entry with id: ${id} could not be found.`;

export const createRequiredPrefixError = (id: string, requiredPrefix: string) =>
  `gt-next Error: You are using <GTProvider> with a provided prefix id: "${requiredPrefix}", but one of the children of <GTProvider> has the id "${id}". Change the <GTProvider> id prop or your dictionary structure to proceed.`;

export const devApiKeyIncludedInProductionError = `gt-next Error: You are attempting a production build using a development API key. Replace this API key with a production API key when you build your app for production.`;

export const createDictionarySubsetError = (id: string, functionName: string) =>
  `gt-next Error: ${functionName} with id: "${id}". Invalid dictionary entry detected. Make sure you are navigating to the correct subroute of the dictionary with the ID you provide.`;

export const dictionaryDisabledError = `gt-next Error: You are trying to use a dictionary, but you have not added the withGTConfig() plugin to your app. You must add withGTConfig() to use dictionaries. For more information, visit generaltranslation.com/docs`;

export const unresolvedCustomLoadDictionaryError = `gt-next Error: loadDictionary() was resolved by plug-in but could not be resolved at run time. This usually means that the file was found, but the loadDictionary() function itself could not be resolved.`;

export const unresolvedCustomLoadTranslationsError = `gt-next Error: loadTranslations() was resolved by plug-in but could not be resolved at run time. This usually means that the file was found, but the loadTranslations() function itself could not be resolved.`;

export const unresolvedLoadDictionaryBuildError = (path: string) =>
  `gt-next Error: File defining loadDictionary() could not be resolved at ${path}`;

export const unresolvedLoadTranslationsBuildError = (path: string) =>
  `gt-next Error: File defining loadTranslations() function could not be resolved at ${path}`;

export const unresolvedGetLocaleBuildError = (path: string) =>
  `gt-next Error: File defining custom getLocale() function could not be resolved at ${path}`;

export const conflictingConfigurationBuildError = (conflicts: string[]) =>
  `gt-next Error: Conflicting configuration${
    conflicts.length > 1 ? 's' : ''
  } detected. Please resolve the following conflicts before building your app:\n${conflicts.join(
    '\n'
  )}`;

export const unsupportedGetLocalePathBuildError =
  'gt-next Error: custom getLocale() function is not currently supported.';

export const typesFileError = `gt-next Error: There is no scenario in which you should be seeing this error.`;

export const gtProviderUseClientError =
  `You're attempting to import the Next.js <GTProvider> in a client component. ` +
  `Are you sure you want to do this? It's better to import <GTProvider> in a file not marked 'use client' so that it can fetch translations on the server. ` +
  `If you really need to put <GTProvider> on the client, import <GTClientProvider> from 'gt-next/client' instead (discouraged when using the Next.js App Router).`;

export const txUseClientError =
  `You're attempting to use the <Tx> runtime translation component in a client component. ` +
  `This is currently unsupported. Please use <T> with variables, ` +
  `or make sure <Tx> rendered on the server only. `;

// ---- WARNINGS ---- //

export const usingDefaultsWarning =
  'gt-next: Unable to access gt-next configuration. Using defaults.';

export const createNoEntryFoundWarning = (id: string) =>
  `gt-next: No valid dictionary entry found for id: "${id}"`;

export const createInvalidDictionaryEntryWarning = (id: string) =>
  `gt-next: Invalid dictionary entry found for id: "${id}"`;

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string
) =>
  `gt-next: Mismatching hashes! Expected hash: ${expectedHash}, but got hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: generaltranslation.com/docs`;

export const projectIdMissingWarn = `gt-next: Project ID missing! Set projectId as GT_PROJECT_ID in your environment or by passing the projectId parameter to withGTConfig(). Find your project ID: generaltranslation.com/dashboard.`;

export const noInitGTWarn =
  `gt-next: You are running General Translation without the withGTConfig() plugin. ` +
  `This means that you are not translating your app. To activate translation, add the withGTConfig() plugin to your app, ` +
  `and set the projectId and apiKey in your environment. ` +
  `For more information, visit https://generaltranslation.com/docs/next/tutorials/quickstart`;

export const APIKeyMissingWarn =
  `gt-next: A Development API key is required for runtime translation!  ` +
  `Find your Development API key: generaltranslation.com/dashboard.  ` +
  `(Or, disable this warning message by setting runtimeUrl to an empty string which disables runtime translation.)`;

export const createTranslationLoadingWarning = ({
  source,
  translation,
  id
}: {
  source: string
  translation: string
  id?: string;
}) => 
    `[DEV ONLY] Warning: gt-next created translation "${source}" -> "${translation}"` +
    (id ? ` for id "${id}"` : '') + `. ` +
  `In development, hot-reloaded translations may not be be displayed until the page is refreshed. ` +
  `In production, translations will be preloaded and there won't be a warning.`
;

export const runtimeTranslationTimeoutWarning = `gt-next: Runtime translation timed out.`;

export const dictionaryNotFoundWarning = `gt-next: Dictionary not found. Make sure you have added a dictionary to your project (either dictionary.js or [defaultLocale].json), and you have added the withGTConfig() plugin.`;

export const standardizedLocalesWarning = (locales: string[]) =>
  `gt-next: You are using The following locales were standardized: ${locales.join(', ')}.`;
