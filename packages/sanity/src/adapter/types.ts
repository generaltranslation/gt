export type FieldMatcher = {
  documentId?: string;
  fields?: { property: string; type?: string }[];
};

export type IgnoreFields = FieldMatcher;

export type DedupeFields = FieldMatcher;

export type SkipFields = FieldMatcher;

export type TranslateDocumentFilter = {
  documentId?: string;
  type?: string;
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
