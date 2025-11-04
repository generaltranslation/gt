import { TranslationRequestConfig, EnqueueFilesResult } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { FileUploadRef } from 'src/types-dir/uploadFiles';

export type EnqueueOptions = {
  sourceLocale: string;
  targetLocales: string[];
  publish?: boolean;
  requireApproval?: boolean;
  modelProvider?: string;
  force?: boolean;
  timeout?: number;
};

/**
 * @internal
 * Enqueues files for translation in the General Translation API.
 * @param files - References of files to translate (file content already uploaded)
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _enqueueFiles(
  files: FileUploadRef[],
  options: EnqueueOptions,
  config: TranslationRequestConfig
): Promise<EnqueueFilesResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/translations/enqueue`;

  const body = {
    files: files.map((f) => ({
      branchId: f.branchId,
      fileId: f.fileId,
      versionId: f.versionId,
      fileName: f.fileName,
    })),
    targetLocales: options.targetLocales,
    sourceLocale: options.sourceLocale,
    publish: options.publish,
    requireApproval: options.requireApproval,
    modelProvider: options.modelProvider,
    force: options.force,
  };

  let response;
  try {
    // Request translations
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(body),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);
  const result = (await response.json()) as EnqueueFilesResult;
  return result;
}
