import { SanityClient, SanityDocumentLike } from 'sanity';
import { gtConfig } from '../../../adapter/core';
import { applyDocuments } from '../../../utils/applyDocuments';

export const createI18nDocAndPatchMetadata = (
  sourceDocument: SanityDocumentLike,
  translatedDoc: SanityDocumentLike,
  localeId: string,
  client: SanityClient,
  translationMetadata: SanityDocumentLike,
  sourceDocumentId: string,
  languageField: string = 'language'
): void => {
  translatedDoc[languageField] = localeId;
  const translations = translationMetadata.translations as Record<
    string,
    any
  >[];
  const existingLocaleKey = translations.find(
    (translation) => translation._key === localeId
  );
  const operation = existingLocaleKey ? 'replace' : 'after';
  const location = existingLocaleKey
    ? `translations[_key == "${localeId}"]`
    : 'translations[-1]';

  //remove system fields
  const { _updatedAt, _createdAt, ...rest } = translatedDoc;

  console.log('translatedDoc', rest);
  const appliedDocument = applyDocuments(
    sourceDocumentId,
    sourceDocument,
    rest,
    gtConfig.getIgnoreFields()
  );

  console.log('appliedDocument', appliedDocument);
  // Check if this is a singleton document and apply singleton mapping
  const singletons = gtConfig.getSingletons();
  const isSingleton = singletons.includes(sourceDocumentId);

  let createDocumentPromise;
  if (isSingleton) {
    const singletonMapping = gtConfig.getSingletonMapping();
    const translatedDocId = singletonMapping(sourceDocumentId, localeId);
    createDocumentPromise = client.create({
      ...appliedDocument,
      _type: rest._type,
      _id: `drafts.${translatedDocId}`,
    });
  } else {
    createDocumentPromise = client.create({
      ...appliedDocument,
      _type: rest._type,
      _id: 'drafts.',
    });
  }

  createDocumentPromise.then((doc) => {
    const _ref = doc._id.replace('drafts.', '');
    client
      .transaction()
      .patch(translationMetadata._id, (p) =>
        p.insert(operation, location, [
          {
            _key: localeId,
            _type: 'internationalizedArrayReferenceValue',
            value: {
              _type: 'reference',
              _ref,
              _weak: true,
              _strengthenOnPublish: {
                type: doc._type,
              },
            },
          },
        ])
      )
      .commit();
  });
};
