export type FileDataQuery =
  import('@generaltranslation/api').GetFileInfoData['body'];

// Compatibility response: the published arrays remain optional while the
// generated response requires both arrays.
export type FileDataResult = {
  sourceFiles?: {
    branchId: string;
    fileId: string;
    versionId: string;
    fileName: string;
    fileFormat: string;
    dataFormat: string | null;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    locales: string[];
    sourceLocale: string;
  }[];
  translatedFiles?: {
    branchId: string;
    fileId: string;
    versionId: string;
    fileFormat: string;
    dataFormat: string | null;
    createdAt: string;
    updatedAt: string;
    approvedAt: string | null;
    publishedAt: string | null;
    completedAt: string | null;
    locale: string;
  }[];
};
