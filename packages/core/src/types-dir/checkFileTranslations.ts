import { CompletedFileTranslationData } from './file';

// Types for the checkFileTranslations function
export type FileTranslationQuery = {
  versionId: string;
  fileName: string;
  locale: string;
};

export type CheckFileTranslationsOptions = {
  timeout?: number;
};

export type CheckFileTranslationsResult = {
  translations: CompletedFileTranslationData[];
};
