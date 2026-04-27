// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import { getPublishedId } from '../../../utils/documentIds';

export const getTranslationMetadata = (
  id: string,
  client: SanityClient,
  baseLanguage: string
): Promise<SanityDocumentLike | null> => {
  return client.fetch(
    `*[
        _type == 'translation.metadata' &&
        translations[language == $baseLanguage][0].value._ref == $id
      ][0]`,
    { baseLanguage, id: getPublishedId(id) }
  );
};
