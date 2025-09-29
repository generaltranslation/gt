export type IgnoreFields = {
  documentId?: string;
  fields?: { property: string; type?: string }[];
};

export type TranslateDocumentFilter = {
  documentId?: string;
  type?: string;
};
