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
 * configured-source-locale entry, which is how every group behaved before the
 * marker existed, so existing content needs no migration.
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
 *   and no source-locale entry, or the marked original no longer exists. Also
 *   the group's original when its language field no longer matches the
 *   language the group records for it.
 */
export type TranslationRole =
  | { kind: 'original'; language: string }
  | { kind: 'translation'; language: string; originalLanguage: string }
  | {
      kind: 'unresolved';
      language: string;
      reason: 'noOriginal' | 'originalMissing';
    }
  | {
      kind: 'unresolved';
      language: string;
      reason: 'languageChanged';
      /** The language the group records for this document. */
      recordedLanguage: string;
    };

/**
 * Whether translating from documents outside the configured source locale is
 * turned on (`allowNonDefaultSourceLocales`). When it is off, every code path
 * behaves as it did before the option existed: only source-locale documents
 * are translated, no translation group is marked, and nothing in this module
 * that reads a translation group is used.
 */
export function allowsNonDefaultSourceLocales(): boolean {
  return pluginConfig.getAllowNonDefaultSourceLocales();
}

/**
 * Whether a document written in `language` is translated from a locale other
 * than the configured source locale. Those translations need their own
 * handling (marker, per-file upload locale, group-wide reference resolution);
 * everything translated from the source locale behaves as it always has.
 */
export function isNonDefaultSourceLanguage(language: string): boolean {
  return language !== pluginConfig.getSourceLocale();
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

  // An unmarked group keeps the rule from before the marker existed: every
  // source-locale document is an original, however the group records its
  // entries.
  if (!metadata[SOURCE_LANGUAGE_FIELD] && documentLanguage === defaultLocale) {
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
    // Translating it would upload a document in one language as the source
    // of a group recorded in another.
    if (documentLanguage !== original.language) {
      return {
        kind: 'unresolved',
        language: documentLanguage,
        reason: 'languageChanged',
        recordedLanguage: original.language,
      };
    }
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
 * Filter matching every translation group a document belongs to, found by the
 * document's own published id (`$id`) rather than through the source-locale
 * entry, so originals in any language — and translations — find their group.
 * Kept to a plain filter so a Studio listener can use it as is.
 */
export const TRANSLATION_GROUP_FILTER = `*[
  _type == '${TRANSLATION_METADATA_TYPE}' &&
  $id in translations[].value._ref
]`;

/**
 * The translation group a document belongs to. Older plugin versions could
 * create a second metadata document for the same original; the oldest one is
 * used. Requires `$id`, the document's published id.
 */
export const TRANSLATION_GROUP_QUERY = `${TRANSLATION_GROUP_FILTER} | order(_createdAt asc)[0]`;

/** The translation group a document belongs to; see `TRANSLATION_GROUP_QUERY`. */
export function findTranslationGroup(
  documentId: string,
  client: SanityClient
): Promise<TranslationGroupMetadata | null> {
  return client.fetch(TRANSLATION_GROUP_QUERY, {
    id: getPublishedId(documentId),
  });
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

/**
 * Resolve a document's role in a translation group already looked up,
 * checking that the group's original still exists when it is another
 * document.
 */
export async function resolveRoleInGroup({
  documentId,
  documentLanguage,
  metadata,
  client,
}: {
  documentId: string;
  documentLanguage: string;
  metadata: TranslationGroupMetadata | null;
  client: SanityClient;
}): Promise<TranslationRole> {
  const publishedId = getPublishedId(documentId);
  let originalExists = true;
  const originalRef = metadata ? getGroupOriginal(metadata).ref : undefined;
  if (originalRef && originalRef !== publishedId) {
    originalExists = await documentExists(originalRef, client);
  }
  return resolveTranslationRole({
    documentId: publishedId,
    documentLanguage,
    metadata,
    originalExists,
  });
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
  const metadata = await findTranslationGroup(documentId, client);
  return {
    role: await resolveRoleInGroup({
      documentId,
      documentLanguage: getDocumentLanguage(document),
      metadata,
      client,
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
  if (role.reason === 'languageChanged') {
    return {
      whatHappened: 'Translation is unavailable for this document',
      why: `its language is ${role.language}, but its translation group records it as ${role.recordedLanguage}`,
      fix: `Change its language back to ${role.recordedLanguage} to translate this group again`,
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
