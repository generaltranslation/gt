// ---- ERRORS ---- //

import { getLocaleProperties } from 'generaltranslation';

export const APIKeyMissingError =
  'General Translation: API key is required for runtime translation! Create an API key: generaltranslation.com/dashboard/api-keys. (Or, turn off runtime translation by setting runtimeUrl to an empty string.)';

export const remoteTranslationsError =
  'General Translation: Error fetching remote translation.';

export const localTranslationsError =
  'General Translation: Error fetching locally stored translation.';

export const createStringTranslationError = (content: string, id?: string) =>
  `gt-next string translation error. tx("${content}")${
    id ? ` with id "${id}"` : ''
  } failed.`;

export const createDictionaryStringTranslationError = (id: string) =>
  `gt-next string translation error. Translation from dictionary with id: ${id} failed.`;

export const createRequiredPrefixError = (id: string, requiredPrefix: string) =>
  `You are using <GTProvider> with a provided prefix id: "${requiredPrefix}", but one of the children of <GTProvider> has the id "${id}". Change the <GTProvider> id prop or your dictionary structure to proceed.`;

export const devApiKeyIncludedInProductionError = `General Translation: You are attempting a production using a development API key. Replace this API key with a production API key when you build your app for production.`;

export const createDictionarySubsetError = (id: string, functionName: string) =>
  `General Translation: ${functionName} with id: "${id}". Invalid dictionary entry detected. Make sure you are navigating to the correct subroute of the dictionary with the ID you provide.`;

// ---- WARNINGS ---- //

export const usingDefaultsWarning =
  'General Translation: Unable to access gt-next configuration. Using defaults.';

export const createNoEntryWarning = (id: string) =>
  `gt-next: No dictionary entry found for id: "${id}"`;

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `General Translation: The following locales are currently unsupported by our service: ${locales
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

export const projectIdMissingWarn =
  'General Translation: Project ID missing! Set projectId as GT_PROJECT_ID in the environment or by passing the projectId parameter to initGT(). Find your project ID: generaltranslation.com/dashboard.';
