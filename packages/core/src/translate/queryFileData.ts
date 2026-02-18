import { TranslationRequestConfig } from '../types';
import { CheckFileTranslationsOptions } from '../types-dir/api/checkFileTranslations';
import apiRequest from './utils/apiRequest';

export type FileDataQuery = {
  sourceFiles?: {
    fileId: string;
    versionId: string;
    branchId: string;
  }[];
  translatedFiles?: {
    fileId: string;
    versionId: string;
    branchId: string;
    locale: string;
  }[];
};

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
    approvalRequiredAt: string | null;
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

/**
 * @internal
 * Queries data about one or more source or translation files.
 * @param data - Object mapping source or translation file information
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The file data
 */
export default async function _queryFileData(
  data: FileDataQuery,
  options: CheckFileTranslationsOptions = {},
  config: TranslationRequestConfig
): Promise<FileDataResult> {
  const body = {
    sourceFiles: data.sourceFiles?.map((item) => ({
      fileId: item.fileId,
      versionId: item.versionId,
      branchId: item.branchId,
    })),
    translatedFiles: data.translatedFiles?.map((item) => ({
      fileId: item.fileId,
      versionId: item.versionId,
      branchId: item.branchId,
      locale: item.locale,
    })),
  };

  return apiRequest<FileDataResult>(config, '/v2/project/files/info', {
    body,
    timeout: options.timeout,
  });
}
