import { TranslationRequestConfig, EnqueueFilesResult } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { FileUploadRef } from 'src/types-dir/uploadFiles';

export type EnqueueByRefOptions = {
  sourceLocale: string;
  targetLocales: string[];
  publish?: boolean;
  requireApproval?: boolean;
  modelProvider?: string;
  force?: boolean;
  timeout?: number;
};

export default async function _enqueueFilesByRef(
  files: FileUploadRef[],
  options: EnqueueByRefOptions,
  config: TranslationRequestConfig
): Promise<EnqueueFilesResult> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/translations/enqueue`;

  const body = {
    files: files.map((f) => ({
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
  const result = (await response.json()) as EnqueueFilesResult;
  return result;
}
