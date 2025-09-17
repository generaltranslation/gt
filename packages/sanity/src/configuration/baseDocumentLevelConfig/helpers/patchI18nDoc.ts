import { SanityClient, SanityDocumentLike } from 'sanity';

export const patchI18nDoc = (
  i18nDocId: string,
  mergedDocument: SanityDocumentLike,
  translatedFields: Record<string, any>,
  client: SanityClient
): void => {
  const cleanedMerge: Record<string, any> = {};
  Object.entries(mergedDocument).forEach(([key, value]) => {
    if (
      //only patch those fields that had translated strings
      key in translatedFields &&
      //don't overwrite any existing system values on the i18n doc
      !['_id', '_rev', '_updatedAt', 'language'].includes(key)
    ) {
      cleanedMerge[key] = value;
    }
  });

  client
    .transaction()
    .patch(i18nDocId, (p) => p.set(cleanedMerge))
    .commit();
};
