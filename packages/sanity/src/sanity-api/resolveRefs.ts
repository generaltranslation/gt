import { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../adapter/core';

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
 */
export async function resolveRefs(
  doc: SanityDocument,
  locale: string,
  client: SanityClient
) {
  const references = findReferences(doc);

  if (references.length === 0) {
    return doc;
  }

  const translatedRefs = await resolveTranslatedReferences(
    references,
    locale,
    client
  );
  return updateDocumentReferences(doc, translatedRefs);
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
  client: SanityClient
): Promise<Map<string, string>> {
  const refIds = references.map((r) => r.ref._ref);
  const translatedRefs = new Map<string, string>();

  if (refIds.length === 0) {
    return translatedRefs;
  }

  const sourceLocale = pluginConfig.getSourceLocale();

  // Optimized GROQ query that directly returns only the needed translation pairs
  const query = `*[_type == "translation.metadata" && count(translations[language == $sourceLocale && value._ref in $refIds]) > 0] {
    "originalRef": translations[language == $sourceLocale][0].value._ref,
    "translatedRefs": translations[language == $locale].value._ref
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
