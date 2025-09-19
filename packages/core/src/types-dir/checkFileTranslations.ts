import { CompletedFileTranslationData } from './file';

// Types for the checkFileTranslations function
export type FileTranslationQuery = {
  versionId: string;
  fileName?: string; // Between fileName and fileId, one is required
  fileId?: string;
  locale: string;
};

export type CheckFileTranslationsOptions = {
  timeout?: number;
};

export type CheckFileTranslationsResult = {
  translations: CompletedFileTranslationData[];
};

export type FileQuery = {
  fileId: string;
  versionId?: string;
};

export type FileQueryResult = {
  sourceFile: {
    id: string;
    fileId: string;
    versionId: string;
    sourceLocale: string;
    fileName: string;
    fileFormat: string;
    dataFormat: string | null;
    createdAt: string;
    updatedAt: string;
    approvalRequiredAt: string | null;
    locales: string[];
  };
  translations: {
    locale: string;
    completedAt: string | null;
    approvedAt: string | null;
    publishedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }[];
};
