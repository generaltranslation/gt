// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import { pluginConfig } from '../../../adapter/core';
import { applyDocuments } from '../../../utils/applyDocuments';

export async function createI18nDocAndPatchMetadata(
  sourceDocument: SanityDocumentLike,
  translatedDoc: SanityDocumentLike,
  localeId: string,
  client: SanityClient,
  translationMetadata: SanityDocumentLike,
  sourceDocumentId: string,
  languageField: string = 'language',
  publish: boolean = false
): Promise<void> {
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

  const appliedDocument = applyDocuments(
    sourceDocumentId,
    sourceDocument,
    rest,
    pluginConfig.getIgnoreFields()
  );

  // Check if this is a singleton document and apply singleton mapping
  const singletons = pluginConfig.getSingletons();
  const isSingleton = singletons.includes(sourceDocumentId);

  let createDocumentPromise;
  if (isSingleton) {
    const singletonMapping = pluginConfig.getSingletonMapping();
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

  const doc = await createDocumentPromise;
  const _ref = doc._id.replace('drafts.', '');
  const result = await client
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

  if (publish) {
    try {
      // only publish if the document is a draft
      if (doc._id.startsWith('drafts.')) {
        await client.action(
          {
            actionType: 'sanity.action.document.publish',
            draftId: doc._id,
            publishedId: doc._id.replace('drafts.', ''),
          },
          {}
        );
      }
    } catch (error) {
      console.error('Error publishing document', error);
    }
  }
}
