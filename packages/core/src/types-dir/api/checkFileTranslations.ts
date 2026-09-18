import type { GetTranslationStatusResponse } from '@generaltranslation/api';

export type CheckFileTranslationsOptions = {
  timeout?: number;
};

export type FileQuery = {
  fileId: string;
  branchId?: string;
  versionId?: string;
};

export type FileQueryResult = GetTranslationStatusResponse;
