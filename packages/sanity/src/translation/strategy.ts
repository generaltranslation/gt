import { SanityClient, SanityDocument, Schema } from 'sanity';
import { pluginConfig } from '../adapter/core';
import { documentLevelPatch } from '../configuration/baseDocumentLevelConfig/documentLevelPatch';
import { internationalizedArrayPatch } from '../configuration/internationalizedArrayConfig/internationalizedArrayPatch';
import type {
  SerializedDocument,
  TranslationLevel,
} from '../serialization/types';
import type { GTFile } from '../types';
import { serializeDocument } from '../utils/serialize';

/**
 * A translation strategy bundles the serialize/patch pair for a given level.
 * The shared GT upload/enqueue/status/download workflow is identical across
 * strategies; only how a document is turned into the GT HTML file and how the
 * translated file is written back to Sanity differs.
 */
export type SanityTranslationAdapter = {
  level: TranslationLevel;
  serialize: (
    document: SanityDocument,
    schema: Schema,
    baseLanguage: string
  ) => SerializedDocument;
  patch: (
    docInfo: GTFile,
    deserialized: SanityDocument,
    localeId: string,
    client: SanityClient,
    mergeWithTargetLocale?: boolean
  ) => Promise<void>;
};

const documentAdapter: SanityTranslationAdapter = {
  level: 'document',
  serialize: (document, schema, baseLanguage) =>
    serializeDocument(document, schema, baseLanguage, 'document'),
  patch: (docInfo, deserialized, localeId, client, mergeWithTargetLocale) =>
    documentLevelPatch(
      docInfo,
      deserialized,
      localeId,
      client,
      pluginConfig.getLanguageField(),
      mergeWithTargetLocale
    ),
};

const internationalizedArrayAdapter: SanityTranslationAdapter = {
  level: 'internationalizedArray',
  serialize: (document, schema, baseLanguage) =>
    serializeDocument(document, schema, baseLanguage, 'internationalizedArray'),
  patch: (docInfo, deserialized, localeId, client) =>
    internationalizedArrayPatch(docInfo, deserialized, localeId, client),
};

function matchesFieldLevel(type: string | undefined): boolean {
  if (!type) {
    return false;
  }
  return pluginConfig
    .getFieldLevelDocuments()
    .some((filter) => filter.type === type);
}

/**
 * Resolve which strategy a document type uses:
 * - `document`               → always document-level (default; unchanged).
 * - `internationalizedArray` → always the array strategy.
 * - `mixed`                  → array strategy for `fieldLevelDocuments`, else
 *                              document-level.
 */
export function getTranslationStrategyForType(
  type: string | undefined
): SanityTranslationAdapter {
  const level = pluginConfig.getTranslationLevel();
  if (level === 'internationalizedArray') {
    return internationalizedArrayAdapter;
  }
  if (level === 'mixed') {
    return matchesFieldLevel(type)
      ? internationalizedArrayAdapter
      : documentAdapter;
  }
  return documentAdapter;
}

export function getTranslationStrategy(
  document: SanityDocument
): SanityTranslationAdapter {
  return getTranslationStrategyForType(document._type);
}
