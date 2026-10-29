import type { SanityClient, SanityDocumentLike } from 'sanity';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { getPublishedId } from './documentIds';
import {
  describeUntranslatableRole,
  getDocumentLanguage,
  isNonDefaultSourceLanguage,
  resolveDocumentRole,
  resolveRoleInGroup,
  type TranslationGroupMetadata,
  type TranslationRole,
} from './translationSource';

/**
 * The open document's role, as the Translate dialog shows it:
 * - `resolving` — still being looked up. Only documents outside the source
 *   locale wait for the lookup.
 * - `resolved` — the role. A source-locale document is assumed to be an
 *   original, as it always was, until its lookup says otherwise.
 * - `unverified` — the lookup failed for a document outside the source
 *   locale, so it is not known to be an original.
 */
export type DocumentRoleState =
  | { status: 'resolving' }
  | { status: 'resolved'; role: TranslationRole }
  | { status: 'unverified' };

/** What the open document's translation group lookup returned. */
export type TranslationGroupSnapshot =
  | { metadata: TranslationGroupMetadata | null }
  | { error: unknown };

/** Shown instead of translation tools when the group could not be checked. */
export const UNVERIFIED_ROLE_MESSAGE = createDiagnosticMessage({
  whatHappened: "This document's translation group couldn't be verified",
  fix: 'Reopen this document to try again, and check the browser console for details if it keeps happening',
});

function createRoleLookupDiagnostic(documentId: string, error: unknown) {
  return createDiagnosticMessage({
    source: 'gt-sanity',
    severity: 'Error',
    whatHappened: 'The translation group of a document could not be looked up',
    details: [
      `Document ID: ${getPublishedId(documentId)}`,
      formatDiagnosticErrorDetails(error) ?? 'Unknown error',
    ],
  });
}

/** The state to show before the lookup for `language` has returned. */
export function getInitialDocumentRoleState(
  language: string
): DocumentRoleState {
  return isNonDefaultSourceLanguage(language)
    ? { status: 'resolving' }
    : { status: 'resolved', role: { kind: 'original', language } };
}

/**
 * The state after a failed lookup. A source-locale document keeps the
 * behavior it always had and stays translatable.
 */
function getFailedLookupState(language: string): DocumentRoleState {
  return isNonDefaultSourceLanguage(language)
    ? { status: 'unverified' }
    : { status: 'resolved', role: { kind: 'original', language } };
}

/** Resolve the open document's role from a lookup of its translation group. */
export async function resolveDocumentRoleState({
  documentId,
  language,
  snapshot,
  client,
}: {
  documentId: string;
  language: string;
  snapshot: TranslationGroupSnapshot;
  client: SanityClient;
}): Promise<DocumentRoleState> {
  try {
    if ('error' in snapshot) throw snapshot.error;
    return {
      status: 'resolved',
      role: await resolveRoleInGroup({
        documentId,
        documentLanguage: language,
        metadata: snapshot.metadata,
        client,
      }),
    };
  } catch (error) {
    console.error(createRoleLookupDiagnostic(documentId, error));
    return getFailedLookupState(language);
  }
}

/** Identifies a translation group lookup's result by group and revision. */
export function getGroupRevision(snapshot: TranslationGroupSnapshot): string {
  if ('error' in snapshot) return 'error';
  return snapshot.metadata
    ? `${snapshot.metadata._id}@${snapshot.metadata._rev ?? ''}`
    : 'none';
}

/**
 * Whether a document may be uploaded as a source right now, looked up fresh
 * rather than read from what is rendered. Only a group's original is ever
 * uploaded. If the lookup fails, a source-locale document is translated as it
 * always was; any other document is not.
 */
export async function checkTranslatableOriginal(
  document: SanityDocumentLike,
  client: SanityClient
): Promise<{ translatable: true } | { translatable: false; message: string }> {
  const language = getDocumentLanguage(document);
  let role: TranslationRole;
  try {
    role = (await resolveDocumentRole(document, client)).role;
  } catch (error) {
    console.error(createRoleLookupDiagnostic(document._id, error));
    return isNonDefaultSourceLanguage(language)
      ? { translatable: false, message: UNVERIFIED_ROLE_MESSAGE }
      : { translatable: true };
  }
  if (role.kind === 'original') return { translatable: true };
  return {
    translatable: false,
    message: createDiagnosticMessage(describeUntranslatableRole(role)),
  };
}
