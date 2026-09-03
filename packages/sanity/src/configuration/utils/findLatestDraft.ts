// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocument } from 'sanity';
import { getPublishedId } from '../../utils/documentIds';

/**
 * Resolves the draft for a document id, falling back to the published copy.
 * Returns `undefined` when neither exists.
 */
export const findLatestDraft = (
  documentId: string,
  client: SanityClient
): Promise<SanityDocument | undefined> => {
  const publishedId = getPublishedId(documentId);
  const query = `*[_id == $id || _id == $draftId]`;
  const params = { id: publishedId, draftId: `drafts.${publishedId}` };
  return client
    .fetch(query, params)
    .then(
      (docs: SanityDocument[]) =>
        docs.find((doc) => doc._id.startsWith('drafts.')) ?? docs[0]
    );
};
