// ---- ERRORS ---- //

export const projectIdMissingError =
  'gt-react Error: General Translation cloud services require a project ID! Find yours at www.generaltranslation.com/dashboard.';

export const devApiKeyProductionError =
  'gt-react Error: Production environments cannot include a development api key.';

export const createNoAuthError =
  'gt-react Error: Configuration is missing a projectId and/or devApiKey. Please add these values to your environment or pass them to the <GTProvider> directly.';

export const createPluralMissingError = (children: any) =>
  `<Plural> component with children "${children}" requires "n" option.`;

export const createStringTranslationError = (content: string, id?: string) =>
  `gt-next string translation error. tx("${content}")${
    id ? ` with id "${id}"` : ''
  } failed.`;

export const createClientSideTDictionaryCollisionError = (id: string) =>
  `<T id="${id}">, "${id}" is also used as a key in the dictionary. Don't give <T> components the same ID as dictionary entries.`;

export const createClientSideTHydrationError = (id: string) =>
  `<T id="${id}"> is used in a client component without a valid saved translation. This can cause hydration errors.` +
  `\n\nTo fix this error, consider using a dictionary with useGT() or pushing translations from the command line in advance.`;

export const createNestedDataGTError = (child: any) =>
  `General Translation already in use on child with props: ${child.props}. This usually occurs when you nest <T> components within the same file. Remove one of the <T> components to continue.`;

export const createNestedTError = (child: any) =>
  `General Translation: Nested <T> components. The inner <T> has the id: "${child?.props?.id}".`;

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

// ---- WARNINGS ---- //

export const createLibraryNoEntryWarning = (id: string) =>
  `gt-react: No dictionary entry found for id: "${id}"`;

export const createNoEntryWarning = (id: string, prefixedId: string) =>
  `t('${id}') finding no translation for dictionary item ${prefixedId} !`;

export const createInvalidElementEntryWarning = (
  id: string,
  prefixedId: string
) =>
  `t('${id}') invalid dictionary entry for ${prefixedId} ! useElement() can only be used to render JSX elements. Strings and other types are not allowed.`;

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string
) =>
  `Mismatching hashes! Expected hash: ${expectedHash}, but got hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs`;

export const createMismatchingIdHashWarning = (
  expectedId: string,
  expectedHash: string,
  receivedId: string,
  receivedHash: string
) =>
  `Mismatching ids or hashes! Expected id: ${expectedId}, hash: ${expectedHash}, but got id: ${receivedId}, hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs`;
