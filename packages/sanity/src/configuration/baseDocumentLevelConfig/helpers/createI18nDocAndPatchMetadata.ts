// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import { pluginConfig } from '../../../adapter/core';
import { applyDocuments } from '../../../utils/applyDocuments';
import { getPublishedId } from '../../../utils/documentIds';
import { randomKey } from '../../../utils/randomKey';

export async function createI18nDocAndPatchMetadata(
  sourceDocument: SanityDocumentLike,
  translatedDoc: SanityDocumentLike,
  localeId: string,
  client: SanityClient,
  translationMetadata: SanityDocumentLike,
  sourceDocumentId: string,
  languageField: string = 'language'
): Promise<void> {
  const publishedSourceDocumentId = getPublishedId(sourceDocumentId);
  translatedDoc[languageField] = localeId;
  const translations = translationMetadata.translations as Record<
    string,
    any
  >[];
  const existingLocaleKey = translations.find(
    (translation) => translation.language === localeId
  );
  const operation = existingLocaleKey ? 'replace' : 'after';
  const location = existingLocaleKey
    ? `translations[language == "${localeId}"]`
    : 'translations[-1]';

  //remove system fields
  const { _updatedAt, _createdAt, ...rest } = translatedDoc;

  const appliedDocument = applyDocuments(
    publishedSourceDocumentId,
    sourceDocument,
    rest,
    pluginConfig.getIgnoreFields(),
    pluginConfig.getSkipFields(),
    pluginConfig.getDedupeFields(),
    localeId
  );

  // Check if this is a singleton document and apply singleton mapping
  const singletons = pluginConfig.getSingletons();
  const isSingleton = singletons.includes(publishedSourceDocumentId);

  let createDocumentPromise;
  if (isSingleton) {
    const singletonMapping = pluginConfig.getSingletonMapping();
    const translatedDocId = singletonMapping(
      publishedSourceDocumentId,
      localeId
    );
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
  const _ref = getPublishedId(doc._id);
  const result = await client
    .transaction()
    .patch(translationMetadata._id, (p) =>
      p.insert(operation, location, [
        {
          _key: randomKey(),
          language: localeId,
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
}
