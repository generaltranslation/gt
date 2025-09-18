import {
  KeyedObject,
  Reference,
  SanityClient,
  SanityDocumentLike,
} from 'sanity';

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
  // First, try to get existing metadata
  const existingMetadata = await client.fetch(
    `*[
        _type == 'translation.metadata' &&
        translations[_key == $baseLanguage][0].value._ref == $id
      ][0]`,
    { baseLanguage, id: documentId.replace('drafts.', '') }
  );

  if (existingMetadata) {
    return existingMetadata;
  }

  // If no metadata exists, create it atomically
  const baseLangEntry: TranslationReference = {
    _key: baseLanguage,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _type: 'reference',
      _ref: baseDocument._id.replace('drafts.', ''),
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

  try {
    // Use createIfNotExists to handle race conditions
    return await client.createIfNotExists({
      _id: `translation.metadata.${documentId.replace('drafts.', '')}`,
      _type: 'translation.metadata',
      translations: [baseLangEntry],
    });
  } catch (error) {
    // If creation fails due to race condition, fetch the existing document
    const metadata = await client.fetch(
      `*[
          _type == 'translation.metadata' &&
          translations[_key == $baseLanguage][0].value._ref == $id
        ][0]`,
      { baseLanguage, id: documentId.replace('drafts.', '') }
    );

    if (metadata) {
      return metadata;
    }

    throw error;
  }
};
