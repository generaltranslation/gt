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
