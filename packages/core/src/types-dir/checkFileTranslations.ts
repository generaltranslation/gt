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
  translations: {
    isReady: boolean;
    fileName: string;
    locale: string;
    id: string;
  }[];
};
