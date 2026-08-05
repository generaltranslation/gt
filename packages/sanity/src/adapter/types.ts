export type FieldMatcher = {
  documentId?: string | null;
  fields?: { property: string; type?: string }[];
};

export type IgnoreFields = FieldMatcher;

export type DedupeFields = FieldMatcher;

export type SkipFields = FieldMatcher;

export type TranslateDocumentFilter = {
  documentId?: string;
  type?: string;
};

// How matched documents are translated:
// - 'document'               translate whole documents (per-locale documents).
// - 'internationalizedArray' localize fields in place (array shape).
// - 'mixed'                  array strategy for `fieldLevelDocuments`, else doc.
export type FieldLevelTranslationMode =
  | 'document'
  | 'internationalizedArray'
  | 'mixed';

/**
 * What the translations UI remembers for the user. Plugin config supplies the
 * defaults; a change the user makes in the Studio is persisted locally and
 * preferred over them.
 */
export type TranslationPreferences = {
  /** Poll for completed translations. */
  autoRefresh: boolean;
  /** Import a translation as soon as it completes. */
  autoImport: boolean;
  /** Repoint references to their translated counterparts after import. */
  autoPatchReferences: boolean;
  /** Publish translated documents after import. */
  autoPublish: boolean;
  /** Send the translations Sanity holds to GT before a run, so they win. */
  preserveExistingTranslations: boolean;
};

export type FileProperties = {
  versionId: string;
  fileId: string;
  locale: string;
  branchId: string;
};
export type TranslationStatus = {
  progress: number;
  isReady: boolean;
  fileData: FileProperties;
};
