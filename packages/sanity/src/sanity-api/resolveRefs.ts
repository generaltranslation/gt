import { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { getPublishedId } from '../utils/documentIds';
import {
  metadataTranslationRef,
  metadataTranslations,
  TRANSLATION_METADATA_TYPE,
} from '../utils/translationMetadata';
import {
  allowsNonDefaultSourceLocales,
  SOURCE_LANGUAGE_FIELD,
} from '../utils/translationSource';

interface Reference {
  _type: 'reference';
  _ref: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReference = (value: unknown): value is Reference =>
  isRecord(value) &&
  value._type === 'reference' &&
  typeof value._ref === 'string';

/**
 * Function that:
 * 1. Finds all references in the document
 * 2. Fetches the referenced documents, looks for the translation.metadata file for each reference
 * 3. Updates the document reference with the other translated document reference
 * 4. Returns the document with the updated references
 *
 * @param sourceLanguage - language of the original `doc` was translated from.
 *   Defaults to the configured source locale.
 */
export async function resolveRefs(
  doc: SanityDocument,
  locale: string,
  client: SanityClient,
  sourceLanguage: string = pluginConfig.getSourceLocale()
) {
  const references = findReferences(doc);

  if (references.length === 0) {
    return doc;
  }

  const translatedRefs = await resolveTranslatedReferences(
    references,
    locale,
    client,
    sourceLanguage
  );
  return updateDocumentReferences(doc, translatedRefs);
}

/**
 * Write resolved references back without publishing them.
 *
 * `findLatestDraft` falls back to the published document when no draft exists,
 * which is the normal state for a translation that has already been published.
 * Patching that id would put the rewritten references live with no review step,
 * so seed a draft from the published state and patch that instead — the same
 * approach `internationalizedArrayPatch` takes.
 *
 * System fields are dropped from the patch: only the resolved content should be
 * written, and `_id` / `_rev` are the document's identity, not its content.
 */
export async function commitResolvedRefs(
  translatedDoc: SanityDocument,
  resolvedDoc: SanityDocument,
  client: SanityClient
): Promise<void> {
  const {
    _id: _resolvedId,
    _rev: _resolvedRev,
    _createdAt: _resolvedCreatedAt,
    _updatedAt: _resolvedUpdatedAt,
    ...changes
  } = resolvedDoc;

  if (translatedDoc._id.startsWith('drafts.')) {
    await client.patch(translatedDoc._id).set(changes).commit();
    return;
  }

  const draftId = `drafts.${getPublishedId(translatedDoc._id)}`;
  await client
    .transaction()
    .createIfNotExists({ ...translatedDoc, _id: draftId })
    .patch(draftId, (patch) => patch.set(changes))
    .commit();
}

/**
 * Recursively finds all references in a document or object
 */
function findReferences(
  obj: unknown,
  path: string[] = []
): { ref: Reference; path: string[] }[] {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const references: { ref: Reference; path: string[] }[] = [];

  if (isReference(obj)) {
    references.push({ ref: obj, path });
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      references.push(...findReferences(item, [...path, index.toString()]));
    });
  } else if (isRecord(obj)) {
    Object.keys(obj).forEach((key) => {
      references.push(...findReferences(obj[key], [...path, key]));
    });
  }

  return references;
}

/**
 * Fetches translation metadata and resolves translated references
 */
async function resolveTranslatedReferences(
  references: { ref: Reference; path: string[] }[],
  locale: string,
  client: SanityClient,
  sourceLanguage: string
): Promise<Map<string, string>> {
  const refIds = references.map((r) => r.ref._ref);
  const translatedRefs = new Map<string, string>();

  if (refIds.length === 0) {
    return translatedRefs;
  }

  const sourceLocale = pluginConfig.getSourceLocale();

  if (!allowsNonDefaultSourceLocales()) {
    return resolveSourceLocaleReferences(refIds, locale, client, sourceLocale);
  }

  if (sourceLanguage !== sourceLocale) {
    return resolveGroupMemberReferences(refIds, locale, client);
  }

  // A source-locale document links to each group's source-locale entry, or
  // to the original of a group marked with a non-default original.
  const originals = metadataTranslations(
    `in [$sourceLocale, ^.${SOURCE_LANGUAGE_FIELD}]`
  );
  const query = `*[_type == "${TRANSLATION_METADATA_TYPE}" && count(${originals}[value._ref in $refIds]) > 0] {
    "originalRefs": ${originals}.value._ref,
    "translatedRefs": ${metadataTranslations('== $locale')}.value._ref
  }[count(translatedRefs) > 0]`;

  const translationPairs: {
    originalRefs: string[];
    translatedRefs: string[];
  }[] = await client.fetch(query, { refIds, sourceLocale, locale });

  // Build the translation map
  for (const { originalRefs, translatedRefs: localeRefs } of translationPairs) {
    const translatedRef = localeRefs[localeRefs.length - 1];
    for (const originalRef of originalRefs) {
      if (originalRef !== translatedRef) {
        translatedRefs.set(originalRef, translatedRef);
      }
    }
  }

  return translatedRefs;
}

/**
 * Without `allowNonDefaultSourceLocales`: each reference to a group's
 * source-locale entry resolves to the group's document in `locale`.
 */
async function resolveSourceLocaleReferences(
  refIds: string[],
  locale: string,
  client: SanityClient,
  sourceLocale: string
): Promise<Map<string, string>> {
  const translatedRefs = new Map<string, string>();

  // Optimized GROQ query that directly returns only the needed translation pairs
  const query = `*[_type == "${TRANSLATION_METADATA_TYPE}" && count(${metadataTranslations('== $sourceLocale', 'value._ref in $refIds')}) > 0] {
    "originalRef": ${metadataTranslationRef('$sourceLocale')},
    "translatedRefs": ${metadataTranslations('== $locale')}.value._ref
  }[defined(originalRef) && count(translatedRefs) > 0]`;

  const translationPairs: { originalRef: string; translatedRefs: string[] }[] =
    await client.fetch(query, { refIds, sourceLocale, locale });

  // Build the translation map
  for (const { originalRef, translatedRefs: localeRefs } of translationPairs) {
    const translatedRef = localeRefs[localeRefs.length - 1];
    translatedRefs.set(originalRef, translatedRef);
  }

  return translatedRefs;
}

/**
 * A document translated from an original outside the configured source locale
 * carries references to documents in that original's locale — originals or
 * translations. Any member of a translation group resolves to the group's
 * document in `locale`.
 */
async function resolveGroupMemberReferences(
  refIds: string[],
  locale: string,
  client: SanityClient
): Promise<Map<string, string>> {
  const translatedRefs = new Map<string, string>();
  const query = `*[_type == "${TRANSLATION_METADATA_TYPE}" && count(translations[value._ref in $refIds]) > 0] {
    "memberRefs": translations[defined(value._ref)].value._ref,
    "translatedRefs": ${metadataTranslations('== $locale')}.value._ref
  }[count(translatedRefs) > 0]`;

  const groups: { memberRefs: string[]; translatedRefs: string[] }[] =
    await client.fetch(query, { refIds, locale });

  const requested = new Set(refIds);
  for (const { memberRefs, translatedRefs: localeRefs } of groups) {
    const translatedRef = localeRefs[localeRefs.length - 1];
    for (const memberRef of memberRefs) {
      if (requested.has(memberRef) && memberRef !== translatedRef) {
        translatedRefs.set(memberRef, translatedRef);
      }
    }
  }
  return translatedRefs;
}

/**
 * Updates document references with their translated versions
 */
function updateDocumentReferences(
  doc: SanityDocument,
  translatedRefs: Map<string, string>
): SanityDocument {
  return updateReferencesRecursive(doc, translatedRefs) as SanityDocument;
}

/**
 * Recursively updates references in an object
 */
function updateReferencesRecursive(
  obj: unknown,
  translatedRefs: Map<string, string>
): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (isReference(obj) && translatedRefs.has(obj._ref)) {
    return {
      ...obj,
      _ref: translatedRefs.get(obj._ref),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => updateReferencesRecursive(item, translatedRefs));
  }

  const updated: Record<string, unknown> = {};
  Object.keys(obj).forEach((key) => {
    updated[key] = updateReferencesRecursive(
      (obj as Record<string, unknown>)[key],
      translatedRefs
    );
  });

  return updated;
}
