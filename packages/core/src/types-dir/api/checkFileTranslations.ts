export type CheckFileTranslationsOptions = {
  timeout?: number;
};

export type FileQuery = {
  fileId: string;
  branchId?: string;
  versionId?: string;
};

export type FileQueryResult =
  import('@generaltranslation/api').GetTranslationStatusResponse;
