import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import { CheckFileTranslationsOptions } from '../types-dir/api/checkFileTranslations';
import generateRequestHeaders from './utils/generateRequestHeaders';

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
  const timeout = Math.min(options.timeout || defaultTimeout, defaultTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/info`;

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
  // Request the file data
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify(body),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse response
  const result = await response.json();
  return result as FileDataResult;
}
