export type CheckFileTranslationsOptions = {
  timeout?: number;
};

export type FileQuery = {
  fileId: string;
  branchId?: string;
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
