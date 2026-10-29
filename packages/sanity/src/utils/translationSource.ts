import type { SanityClient, SanityDocumentLike } from 'sanity';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { pluginConfig } from '../adapter/core';
import { getPublishedId } from './documentIds';
import { TRANSLATION_METADATA_TYPE } from './translationMetadata';

/**
 * Field on a `translation.metadata` document naming the language of the
 * group's original — the one document every other member is translated from.
 *
 * Only written when gt-sanity creates metadata for an original that is not in
 * the configured source locale. Without it, the group's original is its
 * configured-source-locale entry, which is how every group behaved before
 * `allowNonDefaultSourceLocales` existed, so existing content needs no
 * migration.
 */
export const SOURCE_LANGUAGE_FIELD = 'gtSourceLanguage';

/**
 * GROQ expression for a group's original language, evaluated inside a
 * `translations[...]` filter on a metadata document. Requires `$sourceLocale`.
 */
export const GROUP_SOURCE_LANGUAGE = `coalesce(^.${SOURCE_LANGUAGE_FIELD}, $sourceLocale)`;

/** GROQ expression for the `_ref` of a metadata document's original. */
export const GROUP_ORIGINAL_REF = `translations[language == ${GROUP_SOURCE_LANGUAGE}][0].value._ref`;

export type TranslationGroupMetadata = SanityDocumentLike & {
  [SOURCE_LANGUAGE_FIELD]?: string;
  translations?: {
    language?: string;
    value?: { _ref?: string };
  }[];
};

/**
 * What a document is within its translation group:
 * - `original` — the document translations are made from.
 * - `translation` — a translation (machine or hand-written) of the original.
 * - `unresolved` — the group has no original gt-sanity can identify: no marker
 *   and no source-locale entry, or the marked original no longer exists.
 */
export type TranslationRole =
  | { kind: 'original'; language: string }
  | { kind: 'translation'; language: string; originalLanguage: string }
  | {
      kind: 'unresolved';
      language: string;
      reason: 'noOriginal' | 'originalMissing';
    };

/** Whether translating from documents outside the source locale is enabled. */
export function allowsNonDefaultSourceLocales(): boolean {
  return pluginConfig.getAllowNonDefaultSourceLocales();
}

/** The language a document is written in; untagged documents are the source. */
export function getDocumentLanguage(document: Record<string, unknown>): string {
  const language = document[pluginConfig.getLanguageField()];
  return typeof language === 'string' && language
    ? language
    : pluginConfig.getSourceLocale();
}

/** The original's language and `_ref` recorded on a metadata document. */
export function getGroupOriginal(
  metadata: TranslationGroupMetadata,
  defaultLocale: string = pluginConfig.getSourceLocale()
): { language: string; ref: string | undefined; marked: boolean } {
  const marker = metadata[SOURCE_LANGUAGE_FIELD];
  const language = marker || defaultLocale;
  const ref = metadata.translations?.find(
    (translation) =>
      translation.language === language && translation.value?._ref
  )?.value?._ref;
  return { language, ref, marked: Boolean(marker) };
}

/**
 * Resolve a document's role from its translation group.
 *
 * @param originalExists - whether the document the group names as its original
 *   still exists. Only consulted when that document is not `documentId`;
 *   references in metadata are weak, so an entry can outlive its document.
 */
export function resolveTranslationRole({
  documentId,
  documentLanguage,
  metadata,
  defaultLocale = pluginConfig.getSourceLocale(),
  originalExists = true,
}: {
  documentId: string;
  documentLanguage: string;
  metadata: TranslationGroupMetadata | null | undefined;
  defaultLocale?: string;
  originalExists?: boolean;
}): TranslationRole {
  // A document outside any group is an original in its own language.
  if (!metadata) {
    return { kind: 'original', language: documentLanguage };
  }

  const original = getGroupOriginal(metadata, defaultLocale);
  if (!original.ref) {
    return {
      kind: 'unresolved',
      language: documentLanguage,
      reason: original.marked ? 'originalMissing' : 'noOriginal',
    };
  }
  if (original.ref === getPublishedId(documentId)) {
    return { kind: 'original', language: original.language };
  }
  if (!originalExists) {
    return {
      kind: 'unresolved',
      language: documentLanguage,
      reason: 'originalMissing',
    };
  }
  return {
    kind: 'translation',
    language: documentLanguage,
    originalLanguage: original.language,
  };
}

/**
 * The translation group a document belongs to, found by the document's own
 * published id rather than through the source-locale entry, so originals in
 * any language — and translations — find their group.
 *
 * Older plugin versions could create a second metadata document for the same
 * original; the oldest one is used.
 */
export function findTranslationGroup(
  documentId: string,
  client: SanityClient
): Promise<TranslationGroupMetadata | null> {
  return client.fetch(
    `*[
      _type == '${TRANSLATION_METADATA_TYPE}' &&
      count(translations[value._ref == $id]) > 0
    ] | order(_createdAt asc)[0]`,
    { id: getPublishedId(documentId) }
  );
}

async function documentExists(
  documentId: string,
  client: SanityClient
): Promise<boolean> {
  const publishedId = getPublishedId(documentId);
  const count = await client.fetch<number>(`count(*[_id in $ids])`, {
    ids: [publishedId, `drafts.${publishedId}`],
  });
  return count > 0;
}

/** Look up a document's translation group and resolve its role in it. */
export async function resolveDocumentRole(
  document: SanityDocumentLike,
  client: SanityClient
): Promise<{
  role: TranslationRole;
  metadata: TranslationGroupMetadata | null;
}> {
  const documentId = getPublishedId(document._id);
  const documentLanguage = getDocumentLanguage(document);
  const metadata = await findTranslationGroup(documentId, client);

  let originalExists = true;
  const originalRef = metadata ? getGroupOriginal(metadata).ref : undefined;
  if (originalRef && originalRef !== documentId) {
    originalExists = await documentExists(originalRef, client);
  }

  return {
    role: resolveTranslationRole({
      documentId,
      documentLanguage,
      metadata,
      originalExists,
    }),
    metadata,
  };
}

/** Explains why a document cannot be translated from, for UI and errors. */
export function describeUntranslatableRole(
  role: Exclude<TranslationRole, { kind: 'original' }>
): { whatHappened: string; why?: string; fix: string } {
  if (role.kind === 'translation') {
    return {
      whatHappened: `This document is a translation of ${role.originalLanguage}`,
      fix: `Translate from the ${role.originalLanguage} original instead`,
    };
  }
  if (role.reason === 'originalMissing') {
    return {
      whatHappened: 'Translation is unavailable for this document',
      why: 'the original document of its translation group no longer exists',
      fix: 'Restore the original document to translate this group again',
    };
  }
  const sourceLocale = pluginConfig.getSourceLocale();
  return {
    whatHappened: 'Translation is unavailable for this document',
    why: `its translation group has no ${sourceLocale} document and does not name another original`,
    fix: `Add a ${sourceLocale} document to the group to translate from it`,
  };
}

/** Thrown when an import targets a document that is not its group's original. */
export function createNotAnOriginalError(
  documentId: string,
  role: Exclude<TranslationRole, { kind: 'original' }>
): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-sanity',
      severity: 'Error',
      ...describeUntranslatableRole(role),
      details: [`Document ID: ${documentId}`],
    })
  );
}

/**
 * Existing translations of a set of originals, each found through its group's
 * original whatever its language. Requires `$sourceLocale`, `$documentIds`
 * and `$localeIds`.
 */
export const EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY = `*[
  _type == '${TRANSLATION_METADATA_TYPE}' &&
  ${GROUP_ORIGINAL_REF} in $documentIds
] {
  'sourceDocId': ${GROUP_ORIGINAL_REF},
  'sourceLanguage': coalesce(${SOURCE_LANGUAGE_FIELD}, $sourceLocale),
  'existingTranslations': translations[language in $localeIds].language
}`;
