import { getLocaleProperties } from 'generaltranslation';

// ---- ERRORS ---- //

export const projectIdMissingError =
  'gt-react Error: General Translation cloud services require a project ID! Find yours at generaltranslation.com/dashboard.';

export const devApiKeyProductionError =
  'gt-react Error: Production environments cannot include a development api key.';

export const apiKeyInProductionError =
  'gt-react Error: Production environments cannot include an api key.';

export const createNoAuthError =
  'gt-react Error: Configuration is missing a projectId and/or devApiKey. Please add these values to your environment or pass them to the <GTProvider> directly.';

export const createPluralMissingError = (children: any) =>
  `<Plural> component with children "${children}" requires "n" option.`;

export const createClientSideTDictionaryCollisionError = (id: string) =>
  `<T id="${id}">, "${id}" is also used as a key in the dictionary. Don't give <T> components the same ID as dictionary entries.`;

export const createClientSideTHydrationError = (id: string) =>
  `<T id="${id}"> is used in a client component without a valid saved translation. This can cause hydration errors.` +
  `\n\nTo fix this error, consider using a dictionary with useGT() or pushing translations from the command line in advance.`;

export const renderingError = 'General Translation: Rendering error.';

export const dynamicTranslationError = 'Error fetching batched translations:';

export const createGenericRuntimeTranslationError = (
  id: string | undefined,
  hash: string
) => {
  if (!id) {
    return `Translation failed for hash: ${hash}`;
  } else {
    return `Translation failed for id: ${id}, hash: ${hash} `;
  }
};

export const runtimeTranslationError = `gt-react Error: Runtime translation failed: `;

export const customLoadTranslationsError = (locale: string = '') =>
  `gt-react Error: fetching locally stored translations. If you are using a custom loadTranslations(${locale}), make sure it is correctly implemented.`;

export const customLoadDictionaryWarning = (locale: string = '') =>
  `gt-react Error: fetching locally stored dictionary. If you are using a custom loadDictionary(${locale}), make sure it is correctly implemented.`;

export const missingVariablesError = (variables: string[], message: string) =>
  `gt-react Error: missing variables: "${variables.join('", "')}" in message: "${message}"`;

export const createStringRenderError = (
  message: string,
  id: string | undefined
) =>
  `gt-react Error: error rendering string ${id ? `for id: "${id}"` : ''} original message: "${message}"`;

export const createStringTranslationError = (
  string: string,
  id?: string,
  functionName = 'tx'
) =>
  `gt-react string translation error. ${functionName}("${string}")${
    id ? ` with id "${id}"` : ''
  } could not locate translation.`;

export const invalidLocalesError = (locales: string[]) =>
  `gt-react Error: You are using invalid locale codes in your configuration. ` +
  `You must either specify a list of valid locales or use "customMapping" to ` +
  `specify aliases for the following invalid locales: ${locales.join(', ')}.`;

export const invalidCanonicalLocalesError = (locales: string[]) =>
  `gt-react Error: You are using invalid canonical locale codes in your configuration: ${locales.join(', ')}.`;

export const createEmptyIdError = () =>
  `gt-react Error: You cannot provide an empty id to t.obj()`;

export const createSubtreeNotFoundError = (id: string) =>
  `gt-react Error: Dictionary subtree not found for id: "${id}"`;

export const createDictionaryEntryError = () =>
  `gt-react Error: Cannot inject and merge a dictionary entry`;

export const createCannotInjectDictionaryEntryError = () =>
  `gt-react Error: Cannot inject and merge a dictionary entry`;

// ---- WARNINGS ---- //

export const projectIdMissingWarning =
  'gt-react: Translation cloud services require a project ID! Find yours at generaltranslation.com/dashboard.';

export const createNoEntryFoundWarning = (id: string) =>
  `No valid dictionary entry found for id: "${id}"`;

export const createInvalidDictionaryEntryWarning = (id: string) =>
  `Invalid dictionary entry found for id: "${id}"`;

export const createNoEntryTranslationWarning = (
  id: string,
  prefixedId: string
) => `t('${id}') finding no translation for dictionary item ${prefixedId} !`;

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string
) =>
  `Mismatching hashes! Expected hash: ${expectedHash}, but got hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: generaltranslation.com/docs`;

export const APIKeyMissingWarn =
  `gt-react: A development API key is required for runtime translation!  ` +
  `Find your development API key: generaltranslation.com/dashboard.  ` +
  `(Or, disable this warning message by setting runtimeUrl to an empty string which disables runtime translation.)`;

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `gt-react: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const runtimeTranslationTimeoutWarning = `gt-react: Runtime translation timed out.`;

export const createUnsupportedLocaleWarning = (
  validatedLocale: string,
  newLocale: string
) => {
  return (
    `You are trying to switch to "${newLocale}" which is not supported.  ` +
    `Update the list of supported locales through your dashboard or your config.json file if you are using a config file. ` +
    `Falling back to "${validatedLocale}".`
  );
};

export const dictionaryMissingWarning = `gt-react Warning: No dictionary was found. Ensure you are either passing your dictionary to the <GTProvider>.`;
