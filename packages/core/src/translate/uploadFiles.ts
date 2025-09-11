import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { FileToTranslate } from '../types';

export type UploadFilesOptions = {
  sourceLocale: string;
  targetLocales?: string[];
  publish?: boolean;
  requireApproval?: boolean;
  modelProvider?: string;
  force?: boolean;
  timeout?: number;
};

export type UploadedFileRef = {
  fileId: string;
  versionId: string;
  fileName: string;
  fileFormat: string;
  dataFormat?: string;
};

export type UploadFilesResult = {
  shouldGenerateContext: boolean;
  uploadedFiles: UploadedFileRef[];
};

export default async function _uploadFiles(
  files: FileToTranslate[],
  options: UploadFilesOptions,
  config: TranslationRequestConfig
): Promise<UploadFilesResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload`;

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
  const result = (await response.json()) as UploadFilesResult;
  return result;
}
