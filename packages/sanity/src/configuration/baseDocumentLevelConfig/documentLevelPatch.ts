// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocument, SanityDocumentLike } from 'sanity';
import { BaseDocumentMerger } from 'sanity-naive-html-serializer';

import { findLatestDraft } from '../utils/findLatestDraft';
import { findDocumentAtRevision } from '../utils/findDocumentAtRevision';
import { createI18nDocAndPatchMetadata } from './helpers/createI18nDocAndPatchMetadata';
import { getOrCreateTranslationMetadata } from './helpers/getOrCreateTranslationMetadata';
import { patchI18nDoc } from './helpers/patchI18nDoc';
import type { GTFile } from '../../types';
import { gtConfig } from '../../adapter/core';

export const documentLevelPatch = async (
  docInfo: GTFile,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient,
  languageField: string = 'language',
  mergeWithTargetLocale: boolean = false
): Promise<void> => {
  const baseLanguage = gtConfig.getSourceLocale();
  //this is the document we use to merge with the translated fields
  let baseDoc: SanityDocument | null = null;

  //this is the document that will serve as the translated doc
  let i18nDoc: SanityDocument | null = null;

  /*
   * we send over the _rev with our translation file so we can
   * accurately coalesce the translations in case something has
   * changed in the base document since translating
   */
  if (docInfo.documentId && docInfo.versionId) {
    baseDoc = await findDocumentAtRevision(
      docInfo.documentId,
      docInfo.versionId,
      client
    );
  }
  if (!baseDoc) {
    baseDoc = await findLatestDraft(docInfo.documentId, client);
  }

  /* first, check our metadata to see if a translated document exists
   * if no metadata exists, we create it atomically
   */
  const translationMetadata = await getOrCreateTranslationMetadata(
    docInfo.documentId,
    baseDoc,
    client,
    baseLanguage
  );

  //the id of the translated document should be on the metadata if it exists
  const i18nDocId = (
    translationMetadata.translations as Array<Record<string, any>>
  ).find((translation) => translation._key === localeId)?.value?._ref;

  if (i18nDocId) {
    //get draft or published
    i18nDoc = await findLatestDraft(i18nDocId, client);
  }

  //if the user has chosen to merge with the target locale,
  //any existing target document will serve as our base document
  if (mergeWithTargetLocale && i18nDoc) {
    baseDoc = i18nDoc;
  } else if (docInfo.documentId && docInfo.versionId) {
    /*
     * we send over the _rev with our translation file so we can
     * accurately coalesce the translations in case something has
     * changed in the base document since translating
     */
    baseDoc = await findDocumentAtRevision(
      docInfo.documentId,
      docInfo.versionId,
      client
    );
  }

  if (!baseDoc) {
    baseDoc = await findLatestDraft(docInfo.documentId, client);
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

  if (i18nDoc) {
    patchI18nDoc(
      docInfo.documentId,
      i18nDoc._id,
      baseDoc,
      merged,
      translatedFields,
      client
    );
  }
  //otherwise, create a new document
  //and add the document reference to the metadata document
  else {
    createI18nDocAndPatchMetadata(
      baseDoc,
      merged,
      localeId,
      client,
      translationMetadata,
      docInfo.documentId,
      languageField
    );
  }
};
