// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

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

export const createTranslationMetadata = (
  document: SanityDocumentLike,
  client: SanityClient,
  baseLanguage: string
): Promise<SanityDocumentLike> => {
  const baseLangEntry: TranslationReference = {
    _key: baseLanguage,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _type: 'reference',
      _ref: document._id.replace('drafts.', ''),
    },
  };

  if (document._id.startsWith('drafts.')) {
    baseLangEntry.value = {
      ...baseLangEntry.value,
      _weak: true,
      //this should reflect doc i18n config when this
      //plugin is able to take that as a config option
      _strengthenOnPublish: {
        type: document._type,
      },
    };
  }

  return client.create({
    _type: 'translation.metadata',
    translations: [baseLangEntry],
  });
};
