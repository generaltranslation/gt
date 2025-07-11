import { TranslationRequestConfig } from '../types';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateConfig from './utils/validateConfig';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';

/**
 * File object structure for enqueueing files
 * @param content - The content of the file
 * @param fileName - The name of the file
 * @param fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @param dataFormat - The format of the data within the file
 */
export interface FileToTranslate {
  content: string;
  fileName: string;
  fileFormat: 'GTJSON' | 'JSON' | 'YAML' | 'MDX' | 'MD' | 'TS' | 'JS';
  dataFormat: 'JSX' | 'ICU' | 'I18NEXT';
}

export type EnqueueFilesOptions = {
  sourceLocale?: string;
  targetLocales: string[];
  projectId: string;
  publish?: boolean;
  versionId?: string;
  description?: string;
};

export type EnqueueFilesResult = {
  data: unknown;
  locales: string[];
  translations?: unknown;
  message?: string;
};

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
  formData.append('sourceLocale', options.sourceLocale || '');
  formData.append('targetLocales', JSON.stringify(options.targetLocales));
  formData.append('projectId', options.projectId);
  formData.append('publish', String(options.publish || false));
  formData.append('versionId', options.versionId || '');
  formData.append('description', options.description || '');

  // Request the file uploads
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          ...(config.apiKey && { 'x-gt-api-key': config.apiKey }),
        },
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
