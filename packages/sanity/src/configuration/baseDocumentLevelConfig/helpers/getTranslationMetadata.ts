// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocumentLike } from 'sanity';
import { getPublishedId } from '../../../utils/documentIds';
import {
  metadataTranslationRef,
  TRANSLATION_METADATA_TYPE,
} from '../../../utils/translationMetadata';

export const getTranslationMetadata = (
  id: string,
  client: SanityClient,
  baseLanguage: string
): Promise<SanityDocumentLike | null> => {
  return client.fetch(
    `*[
        _type == '${TRANSLATION_METADATA_TYPE}' &&
        ${metadataTranslationRef('$baseLanguage')} == $id
      ][0]`,
    { baseLanguage, id: getPublishedId(id) }
  );
};
