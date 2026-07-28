/**
 * GROQ fragments for reading `translation.metadata` documents, single-sourced
 * so every query stays in sync with the write path
 * (`createI18nDocAndPatchMetadata` / `getOrCreateTranslationMetadata`).
 *
 * The locale of each `translations[]` entry lives in its literal `language`
 * property. That is the storage shape of the metadata document itself and is
 * unrelated to the configurable `languageField` option, which only renames
 * the language field on content documents.
 */
export const TRANSLATION_METADATA_TYPE = 'translation.metadata';

/** Deterministic metadata document id for a source document. */
export function translationMetadataId(publishedDocumentId: string): string {
  return `${TRANSLATION_METADATA_TYPE}.${publishedDocumentId}`;
}

/**
 * `translations[]` entries whose `language` matches a GROQ condition, e.g.
 * `metadataTranslations('== $sourceLocale')` or
 * `metadataTranslations('in $localeIds', 'defined(value._ref)')`.
 */
export function metadataTranslations(
  languageCondition: string,
  extraCondition?: string
): string {
  return `translations[language ${languageCondition}${
    extraCondition ? ` && ${extraCondition}` : ''
  }]`;
}

/**
 * The `_ref` of the document recorded for a language, e.g.
 * `metadataTranslationRef('$sourceLocale')`.
 */
export function metadataTranslationRef(languageExpression: string): string {
  return `${metadataTranslations(`== ${languageExpression}`)}[0].value._ref`;
}
