// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';

export const getTranslationMetadata = (
  id: string,
  client: SanityClient,
  baseLanguage: string
): Promise<SanityDocumentLike | null> => {
  return client.fetch(
    `*[
        _type == 'translation.metadata' &&
        translations[_key == $baseLanguage][0].value._ref == $id
      ][0]`,
    { baseLanguage, id: id.replace('drafts.', '') }
  );
};
