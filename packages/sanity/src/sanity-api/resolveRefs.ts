import { SanityClient, SanityDocument } from 'sanity';
import { pluginConfig } from '../adapter/core';

interface Reference {
  _type: 'reference';
  _ref: string;
}

interface TranslationMetadata {
  _id: string;
  _type: 'translation.metadata';
  translations: {
    _key: string;
    value: Reference;
  }[];
}

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
  obj: any,
  path: string[] = []
): { ref: Reference; path: string[] }[] {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const references: { ref: Reference; path: string[] }[] = [];

  if (obj._ref) {
    references.push({ ref: obj as Reference, path });
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      references.push(...findReferences(item, [...path, index.toString()]));
    });
  } else {
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
  const query = `*[_type == "translation.metadata" && count(translations[_key == $sourceLocale && value._ref in $refIds]) > 0] {
    "originalRef": translations[_key == $sourceLocale][0].value._ref,
    "translatedRef": translations[_key == $locale][0].value._ref
  }[defined(originalRef) && defined(translatedRef)]`;

  const translationPairs: { originalRef: string; translatedRef: string }[] =
    await client.fetch(query, { refIds, sourceLocale, locale });

  // Build the translation map
  for (const { originalRef, translatedRef } of translationPairs) {
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
  return updateReferencesRecursive(doc, translatedRefs);
}

/**
 * Recursively updates references in an object
 */
function updateReferencesRecursive(
  obj: any,
  translatedRefs: Map<string, string>
): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (obj._ref && translatedRefs.has(obj._ref)) {
    return {
      ...obj,
      _ref: translatedRefs.get(obj._ref),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => updateReferencesRecursive(item, translatedRefs));
  }

  const updated: any = {};
  Object.keys(obj).forEach((key) => {
    updated[key] = updateReferencesRecursive(obj[key], translatedRefs);
  });

  return updated;
}
