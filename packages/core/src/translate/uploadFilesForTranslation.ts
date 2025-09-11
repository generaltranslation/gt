import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { FileToTranslate } from '../types';
import {
  UploadFilesForTranslationOptions,
  UploadFilesForTranslationResult,
} from 'src/types-dir/uploadFilesForTranslation';

export default async function _uploadFilesForTranslation(
  files: FileToTranslate[],
  options: UploadFilesForTranslationOptions,
  config: TranslationRequestConfig
): Promise<UploadFilesForTranslationResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/uploadForTranslation`;

  const fileData = files.map((file) => ({
    content: Buffer.from(file.content).toString('base64'),
    fileName: file.fileName,
    fileFormat: file.fileFormat,
    fileDataFormat: file.dataFormat,
    formatMetadata: file.formatMetadata,
  }));

  const body = {
    files: fileData,
    sourceLocale: options.sourceLocale,
    ...(options.targetLocales && { targetLocales: options.targetLocales }),
    // Optional fields included for parity, server ignores publish/requireApproval here
    publish: options.publish,
    requireApproval: options.requireApproval,
    modelProvider: options.modelProvider,
    force: options.force,
    projectId: config.projectId,
  };

  let response;
  try {
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

  await validateResponse(response);
  const result = (await response.json()) as UploadFilesForTranslationResult;
  return result;
}
