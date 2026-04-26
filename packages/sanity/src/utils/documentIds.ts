import type { SanityDocument } from 'sanity';

export function getPublishedId(documentId: string): string {
  return documentId.startsWith('drafts.') ? documentId.slice(7) : documentId;
}

export function getDocumentPublishedId(document: SanityDocument): string {
  return getPublishedId(document._id);
}

export function dedupeDocumentsPreferDraft<T extends SanityDocument>(
  documents: T[]
): T[] {
  const byPublishedId = new Map<string, T>();

  for (const document of documents) {
    const publishedId = getDocumentPublishedId(document);
    const existing = byPublishedId.get(publishedId);

    if (!existing || document._id.startsWith('drafts.')) {
      byPublishedId.set(publishedId, document);
    }
  }

  return Array.from(byPublishedId.values());
}

export function createTranslationStatusKey(
  branchId: string | undefined,
  documentId: string,
  versionId: string,
  localeId: string
): string {
  return `${branchId}:${getPublishedId(documentId)}:${versionId}:${localeId}`;
}

export function createStableTranslationKey(
  branchId: string | undefined,
  documentId: string,
  localeId: string
): string {
  const publishedId = getPublishedId(documentId);
  return branchId
    ? `${branchId}:${publishedId}:${localeId}`
    : `${publishedId}:${localeId}`;
}
