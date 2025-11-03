import { getLocaleProperties } from 'generaltranslation';
import { PACKAGE_NAME } from './constants';

// ---- ERRORS ---- //

export const projectIdMissingError = `${PACKAGE_NAME} Error: General Translation cloud services require a project ID! Find yours at generaltranslation.com/dashboard.`;

export const devApiKeyProductionError = `${PACKAGE_NAME} Error: Production environments cannot include a development api key.`;

export const apiKeyInProductionError = `${PACKAGE_NAME} Error: Production environments cannot include an api key.`;

export const createNoAuthError = `${PACKAGE_NAME} Error: Configuration is missing a projectId and/or devApiKey. Please add these values to your environment or pass them to the <GTProvider> directly.`;

export const createPluralMissingError = (children: any) =>
  `${PACKAGE_NAME} Error: <Plural> component with children "${children}" requires "n" option.`;

export const createClientSideTDictionaryCollisionError = (id: string) =>
  `${PACKAGE_NAME} Error: <T id="${id}">, "${id}" is also used as a key in the dictionary. Don't give <T> components the same ID as dictionary entries.`;

export const createClientSideTHydrationError = (id: string) =>
  `${PACKAGE_NAME} Error: <T id="${id}"> is used in a client component without a valid saved translation. This can cause hydration errors.` +
  `\n\nTo fix this error, consider using a dictionary with useGT() or pushing translations from the command line in advance.`;

export const dynamicTranslationError = `${PACKAGE_NAME} Error: Fetching batched translations failed`;

export const createGenericRuntimeTranslationError = (
  id: string | undefined,
  hash: string
) => {
  if (!id) {
    return `${PACKAGE_NAME} Error: Translation failed for hash: ${hash}`;
  } else {
    return `${PACKAGE_NAME} Error: Translation failed for id: ${id}, hash: ${hash} `;
  }
};

export const runtimeTranslationError = `${PACKAGE_NAME} Error: Runtime translation failed: `;

export const customLoadTranslationsError = (locale: string = '') =>
  `${PACKAGE_NAME} Error: fetching locally stored translations. If you are using a custom loadTranslations(${locale}), make sure it is correctly implemented.`;

export const customLoadDictionaryWarning = (locale: string = '') =>
  `${PACKAGE_NAME} Error: fetching locally stored dictionary. If you are using a custom loadDictionary(${locale}), make sure it is correctly implemented.`;

export const missingVariablesError = (variables: string[], message: string) =>
  `${PACKAGE_NAME} Error: missing variables: "${variables.join('", "')}" in message: "${message}"`;

export const createStringRenderError = (
  message: string,
  id: string | undefined
) =>
  `${PACKAGE_NAME} Error: error rendering string ${id ? `for id: "${id}"` : ''} original message: "${message}"`;

export const createStringTranslationError = (
  string: string,
  id?: string,
  functionName = 'tx'
) =>
  `${PACKAGE_NAME} Error: string translation error. ${functionName}("${string}")${
    id ? ` with id "${id}"` : ''
  } could not locate translation.`;

export const invalidLocalesError = (locales: string[]) =>
  `${PACKAGE_NAME} Error: You are using invalid locale codes in your configuration. ` +
  `You must either specify a list of valid locales or use "customMapping" to ` +
  `specify aliases for the following invalid locales: ${locales.join(', ')}.`;

export const invalidCanonicalLocalesError = (locales: string[]) =>
  `${PACKAGE_NAME} Error: You are using invalid canonical locale codes in your configuration: ${locales.join(', ')}.`;

export const createEmptyIdError = () =>
  `${PACKAGE_NAME} Error: You cannot provide an empty id to t.obj()`;

export const createSubtreeNotFoundError = (id: string) =>
  `${PACKAGE_NAME} Error: Dictionary subtree not found for id: "${id}"`;

export const createDictionaryEntryError = () =>
  `${PACKAGE_NAME} Error: Cannot inject and merge a dictionary entry`;

export const createCannotInjectDictionaryEntryError = () =>
  `${PACKAGE_NAME} Error: Cannot inject and merge a dictionary entry`;

// ---- WARNINGS ---- //

export const projectIdMissingWarning = `${PACKAGE_NAME} Warning: Translation cloud services require a project ID! Find yours at generaltranslation.com/dashboard.`;

export const createNoEntryFoundWarning = (id: string) =>
  `${PACKAGE_NAME} Warning: No valid dictionary entry found for id: "${id}"`;

export const createInvalidDictionaryEntryWarning = (id: string) =>
  `${PACKAGE_NAME} Warning: Invalid dictionary entry found for id: "${id}"`;

export const createNoEntryTranslationWarning = (
  id: string,
  prefixedId: string
) =>
  `${PACKAGE_NAME} Warning: t('${id}') finding no translation for dictionary item ${prefixedId} !`;

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string
) =>
  `${PACKAGE_NAME} Warning: Mismatching hashes! Expected hash: ${expectedHash}, but got hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: generaltranslation.com/docs`;

export const APIKeyMissingWarn =
  `${PACKAGE_NAME} Warning: A development API key is required for runtime translation!  ` +
  `Find your development API key: generaltranslation.com/dashboard.  ` +
  `(Or, disable this warning message by setting runtimeUrl to an empty string which disables runtime translation.)`;

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `${PACKAGE_NAME} Warning: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const runtimeTranslationTimeoutWarning = `${PACKAGE_NAME} Warning: Runtime translation timed out.`;

export const createUnsupportedLocaleWarning = (
  validatedLocale: string,
  newLocale: string,
  packageName: string = PACKAGE_NAME
) => {
  return (
    `${packageName} Warning: You are trying to switch to "${newLocale}" which is not supported.  ` +
    `Update the list of supported locales through your dashboard or your config.json file if you are using a config file. ` +
    `Falling back to "${validatedLocale}".`
  );
};

export const dictionaryMissingWarning = `${PACKAGE_NAME} Warning: No dictionary was found. Ensure you are either passing your dictionary to the <GTProvider>.`;

export const createStringRenderWarning = (
  message: string,
  id: string | undefined
) =>
  `${PACKAGE_NAME} Warning: failed to render string ${id ? `for id: "${id}"` : ''} original message: "${message}"`;

export const msgStringFormatWarning = (message: string) =>
  `${PACKAGE_NAME} Warning: error formatting string. Expect translation resolution to fail. Original message: "${message}"`;
