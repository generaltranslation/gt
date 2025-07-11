// Types for the checkFileTranslations function
export type FileTranslationCheck = {
  versionId: string;
  fileName: string;
};

export type CheckFileTranslationsOptions = {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  locales?: string[];
  timeout?: number;
};

export type CheckFileTranslationsResult = {
  files: {
    translationId: string;
    locale: string;
    fileName: string;
    status: 'ready' | 'processing' | 'failed';
    downloadUrl?: string;
  };
};
