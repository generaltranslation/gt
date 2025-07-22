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
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/translations/files/upload`;
  const { projectId } = config;
  const { sourceLocale, targetLocales, publish, _versionId, description } =
    options;

  // Create form data
  const formData = new FormData();

  // Add each file to the form data
  files.forEach((file, index) => {
    formData.append(`file${index}`, new Blob([file.content]), file.fileName);
    formData.append(`fileFormat${index}`, file.fileFormat);
    formData.append(`fileDataFormat${index}`, file.dataFormat);
    formData.append(`fileName${index}`, file.fileName);
  });

  // Add number of files
  formData.append('fileCount', String(files.length));

  // Add other metadata
  formData.append('sourceLocale', sourceLocale);
  formData.append('targetLocales', JSON.stringify(targetLocales));
  formData.append('projectId', projectId);
  formData.append('publish', String(publish));
  formData.append('versionId', _versionId || '');
  formData.append('description', description || '');

  // Request the file uploads
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, true),
        body: formData,
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
