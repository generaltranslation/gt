import { useEffect, useState } from 'react';
import type { DocumentStore, SanityClient } from 'sanity';
import { getPublishedId } from '../utils/documentIds';
import {
  getGroupRevision,
  getInitialDocumentRoleState,
  resolveDocumentRoleState,
  type DocumentRoleState,
  type TranslationGroupSnapshot,
} from '../utils/documentRoleState';
import {
  TRANSLATION_GROUP_FILTER,
  TRANSLATION_GROUP_QUERY,
  type TranslationGroupMetadata,
} from '../utils/translationSource';

type GroupSnapshotFor = {
  documentId: string;
  snapshot: TranslationGroupSnapshot;
  revision: string;
};

/**
 * The open document's role in its translation group.
 *
 * The group is read through a Studio listener, so adding the document to a
 * group, removing it, or changing which member is the original updates the
 * role without reopening the document. A lookup that returns after the
 * document, its language, or its group has changed again is discarded.
 *
 * @returns `null` when no document is open.
 */
export function useDocumentRole({
  documentId,
  language,
  client,
  documentStore,
}: {
  documentId: string | undefined;
  language: string | undefined;
  client: SanityClient;
  documentStore: Pick<DocumentStore, 'listenQuery'>;
}): DocumentRoleState | null {
  const publishedId = documentId ? getPublishedId(documentId) : undefined;
  const [group, setGroup] = useState<GroupSnapshotFor | null>(null);
  const [lookup, setLookup] = useState<{
    documentId: string;
    language: string;
    state: DocumentRoleState;
  } | null>(null);

  // Keeps the group in sync with the dataset (an external system).
  useEffect(() => {
    if (!publishedId) return;
    const update = (snapshot: TranslationGroupSnapshot) => {
      // Only the group's identity and revision matter; an unchanged one is
      // kept so nothing is looked up again.
      const revision = getGroupRevision(snapshot);
      setGroup((previous) =>
        previous?.documentId === publishedId && previous.revision === revision
          ? previous
          : { documentId: publishedId, snapshot, revision }
      );
    };
    const subscription = documentStore
      .listenQuery(
        { fetch: TRANSLATION_GROUP_QUERY, listen: TRANSLATION_GROUP_FILTER },
        { id: publishedId },
        { transitions: ['appear', 'update', 'disappear'] }
      )
      .subscribe({
        next: (metadata: TranslationGroupMetadata | null) =>
          update({ metadata: metadata ?? null }),
        error: (error: unknown) => update({ error }),
      });
    return () => subscription.unsubscribe();
  }, [documentStore, publishedId]);

  const currentGroup = group?.documentId === publishedId ? group : null;

  // Resolving the role may read the dataset again (whether the original
  // still exists), so it is asynchronous too.
  useEffect(() => {
    if (!publishedId || !language || !currentGroup) return;
    let current = true;
    resolveDocumentRoleState({
      documentId: publishedId,
      language,
      snapshot: currentGroup.snapshot,
      client,
    }).then((state) => {
      if (current) {
        setLookup({ documentId: publishedId, language, state });
      }
    });
    return () => {
      current = false;
    };
  }, [client, publishedId, language, currentGroup]);

  if (!publishedId || !language) return null;
  // While the group is looked up again after a change, the role last resolved
  // for this document in this language stays on screen; translating looks
  // the role up afresh either way.
  return lookup &&
    lookup.documentId === publishedId &&
    lookup.language === language
    ? lookup.state
    : getInitialDocumentRoleState(language);
}
