import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import {
  FileToTranslate,
  EnqueueFilesResult,
  RequiredEnqueueFilesOptions,
} from '../types-dir/enqueueFiles';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Sends multiple files for translation to the General Translation API.
 * @param files - The files to translate
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _enqueueFiles(
  files: FileToTranslate[],
  options: RequiredEnqueueFilesOptions,
  config: TranslationRequestConfig
): Promise<EnqueueFilesResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/translations/files/upload`;
  const { projectId } = config;
  const {
    sourceLocale,
    targetLocales,
    publish,
    requireApproval,
    version,
    modelProvider,
    force,
  } = options;

  const fileData = files.map((file) => ({
    content: Buffer.from(file.content).toString('base64'),
    fileName: file.fileName,
    fileFormat: file.fileFormat,
    fileDataFormat: file.dataFormat,
    formatMetadata: file.formatMetadata,
  }));

  const uploadData = {
    files: fileData,
    sourceLocale,
    targetLocales,
    projectId,
    publish,
    requireApproval,
    version,
    modelProvider,
    force,
  };

  // Request the file uploads
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(uploadData),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse response
  const responseData = await response.json();
  return responseData as EnqueueFilesResult;
}
