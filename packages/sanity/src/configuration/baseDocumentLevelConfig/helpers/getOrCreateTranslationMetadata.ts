// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import {
  KeyedObject,
  Reference,
  SanityClient,
  SanityDocumentLike,
} from 'sanity';
import { randomKey } from '../../../utils/randomKey';
import { getPublishedId } from '../../../utils/documentIds';
import {
  metadataTranslationRef,
  translationMetadataId,
  TRANSLATION_METADATA_TYPE,
} from '../../../utils/translationMetadata';
import {
  allowsNonDefaultSourceLocales,
  createNotAnOriginalError,
  findTranslationGroup,
  isNonDefaultSourceLanguage,
  resolveTranslationRole,
  SOURCE_LANGUAGE_FIELD,
  type TranslationGroupMetadata,
} from '../../../utils/translationSource';

type TranslationReference = KeyedObject & {
  _type: 'internationalizedArrayReferenceValue';
  value: Reference;
};

export const getOrCreateTranslationMetadata = async (
  documentId: string,
  baseDocument: SanityDocumentLike,
  client: SanityClient,
  baseLanguage: string
): Promise<SanityDocumentLike> => {
  const publishedId = getPublishedId(documentId);
  // Without `allowNonDefaultSourceLocales`, groups are found through their
  // `baseLanguage` entry, never marked, and never checked for their original.
  const allowNonDefault = allowsNonDefaultSourceLocales();
  const nonDefaultSource =
    allowNonDefault && isNonDefaultSourceLanguage(baseLanguage);

  const findExisting = async (): Promise<SanityDocumentLike | null> => {
    // An original in the configured source locale finds its group through
    // that entry, as it always has.
    if (!nonDefaultSource) {
      const metadata: TranslationGroupMetadata | null = await client.fetch(
        `*[
          _type == '${TRANSLATION_METADATA_TYPE}' &&
          ${metadataTranslationRef('$baseLanguage')} == $id
        ][0]`,
        { baseLanguage, id: publishedId }
      );
      // A group marked with another original makes this document one of its
      // translations, which is never translated from.
      if (metadata && allowNonDefault) assertOriginal(metadata);
      return metadata;
    }
    // An original in another locale is found by its own id: looking it up
    // through the `baseLanguage` entry misses a group the document already
    // belongs to and creates a second, conflicting one.
    const group = await findTranslationGroup(publishedId, client);
    if (group) assertOriginal(group);
    return group;
  };

  // Only a group's original is translated from. Importing into a group
  // through any other member would treat a translation as the source.
  function assertOriginal(metadata: TranslationGroupMetadata): void {
    const role = resolveTranslationRole({
      documentId: publishedId,
      documentLanguage: baseLanguage,
      metadata,
    });
    if (role.kind !== 'original') {
      throw createNotAnOriginalError(publishedId, role);
    }
  }

  // First, try to get existing metadata
  const existingMetadata = await findExisting();

  if (existingMetadata) {
    return existingMetadata;
  }

  // If no metadata exists, create it atomically
  const baseLangEntry: TranslationReference = {
    _key: randomKey(),
    language: baseLanguage,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _type: 'reference',
      _ref: getPublishedId(baseDocument._id),
    },
  };

  if (baseDocument._id.startsWith('drafts.')) {
    baseLangEntry.value = {
      ...baseLangEntry.value,
      _weak: true,
      //this should reflect doc i18n config when this
      //plugin is able to take that as a config option
      _strengthenOnPublish: {
        type: baseDocument._type,
      },
    };
  }

  let metadata: TranslationGroupMetadata;
  try {
    // Use createIfNotExists to handle race conditions
    metadata = await client.createIfNotExists({
      _id: translationMetadataId(publishedId),
      _type: TRANSLATION_METADATA_TYPE,
      translations: [baseLangEntry],
      // Marks the group's original when it is not in the configured source
      // locale. Without the marker, the source-locale entry is the original.
      ...(nonDefaultSource && { [SOURCE_LANGUAGE_FIELD]: baseLanguage }),
    });
  } catch (error) {
    // If creation fails due to race condition, fetch the existing document
    const existing = await findExisting();

    if (existing) {
      return existing;
    }

    throw error;
  }

  // createIfNotExists returns a metadata document already stored under this
  // id unchanged, which need not name this document as its original.
  if (allowNonDefault) assertOriginal(metadata);
  return metadata;
};
