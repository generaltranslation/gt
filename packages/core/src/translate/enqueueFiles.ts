import { TranslationRequestConfig } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateConfig from './utils/validateConfig';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import {
  FileToTranslate,
  EnqueueFilesOptions,
  EnqueueFilesResult,
} from '../_types/enqueue';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Lightweight version of sendFiles that abstracts out only the API fetch request.
 * Sends multiple files for translation to the General Translation API.
 */
export default async function _enqueueFiles(
  files: FileToTranslate[],
  options: EnqueueFilesOptions,
  config: TranslationRequestConfig
): Promise<EnqueueFilesResult> {
  const timeout = Math.min(config.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/project/translations/files/upload`;
  const { projectId } = config;
  const { sourceLocale, targetLocales, publish, _versionId, description } =
    options;

  // Validation
  validateConfig(config);

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
  formData.append('sourceLocale', sourceLocale || '');
  formData.append('targetLocales', JSON.stringify(targetLocales));
  formData.append('projectId', projectId);
  formData.append('publish', String(publish || false));
  formData.append('versionId', _versionId || '');
  formData.append('description', description || '');

  // Request the file uploads
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: formData,
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response!);

  // Parse response
  const responseData = await response!.json();
  const { data, message, locales, translations } = responseData as {
    data: unknown;
    message?: string;
    locales: string[];
    translations?: unknown;
  };

  return { data, locales, translations, message };
}
