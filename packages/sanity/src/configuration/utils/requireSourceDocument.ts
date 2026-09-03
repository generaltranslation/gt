import { SanityClient, SanityDocument } from 'sanity';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { findLatestDraft } from './findLatestDraft';
import { findDocumentAtRevision } from './findDocumentAtRevision';

/**
 * Resolves the document a translation is written against, preferring the
 * revision the translation was produced from and falling back to the latest
 * draft or published copy.
 *
 * Throws when nothing resolves.
 */
export async function requireSourceDocument(
  documentId: string,
  versionId: string | undefined,
  client: SanityClient
): Promise<SanityDocument> {
  let doc: SanityDocument | null | undefined = null;

  if (documentId && versionId) {
    doc = await findDocumentAtRevision(documentId, versionId, client);
  }
  if (!doc) {
    doc = await findLatestDraft(documentId, client);
  }
  if (!doc) {
    throw new Error(missingDocumentDiagnostic(documentId));
  }

  return doc;
}

/**
 * Resolves a document that must already exist, without the revision lookup.
 */
export async function requireLatestDraft(
  documentId: string,
  client: SanityClient
): Promise<SanityDocument> {
  const doc = await findLatestDraft(documentId, client);
  if (!doc) {
    throw new Error(missingDocumentDiagnostic(documentId));
  }
  return doc;
}

function missingDocumentDiagnostic(documentId: string): string {
  return createDiagnosticMessage({
    source: 'gt-sanity',
    severity: 'Error',
    whatHappened: 'Could not find the document to translate',
    why: 'no draft or published version of it exists in this dataset',
    fix: 'Check that the document was not deleted, and that the Studio is pointed at the dataset that holds it',
    details: [`Document ID: ${documentId}`],
  });
}
