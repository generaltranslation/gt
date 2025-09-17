import { SanityClient, SanityDocument, SanityDocumentLike } from 'sanity';
import { BaseDocumentMerger } from 'sanity-naive-html-serializer';

import { findLatestDraft, findDocumentAtRevision } from '../utils';

export const legacyDocumentLevelPatch = async (
  documentId: string,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient
): Promise<void> => {
  let baseDoc: SanityDocument | null = null;

  /*
   * we send over the _rev with our translation file so we can
   * accurately coalesce the translations in case something has
   * changed in the base document since translating
   */
  if (translatedFields._id && translatedFields._rev) {
    baseDoc = await findDocumentAtRevision(
      translatedFields._id,
      translatedFields._rev,
      client
    );
  }
  if (!baseDoc) {
    baseDoc = await findLatestDraft(documentId, client);
  }

  /*
   * we then merge the translation with the base document
   * to create a document that contains the translation and everything
   * that wasn't sent over for translation
   */
  const merged = BaseDocumentMerger.documentLevelMerge(
    translatedFields,
    baseDoc
  ) as SanityDocumentLike;

  /* we now need to check if we have a translated document
   * if not, we create it
   */
  const targetId = `drafts.${documentId}__i18n_${localeId}`;
  const i18nDoc = await findLatestDraft(targetId, client);
  if (i18nDoc) {
    const cleanedMerge: Record<string, any> = {};
    //don't overwrite any existing system values on the i18n doc
    Object.entries(merged).forEach(([key, value]) => {
      if (
        Object.keys(translatedFields).includes(key) &&
        !['_id', '_rev', '_updatedAt'].includes(key)
      ) {
        cleanedMerge[key] = value;
      }
    });

    await client
      .transaction()
      //@ts-ignore
      .patch(i18nDoc._id, (p) => p.set(cleanedMerge))
      .commit();
  } else {
    merged._id = targetId;

    merged.__i18n_lang = localeId;
    client.create(merged);
  }
};
