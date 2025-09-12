import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { FileUploadRef } from 'src/types-dir/uploadFiles';

export type GenerateContextResult = {
  contextJobId: string;
  status: 'queued';
};

export default async function _generateContext(
  files: FileUploadRef[],
  config: TranslationRequestConfig,
  timeoutMs?: number
): Promise<GenerateContextResult> {
  const timeout = Math.min(timeoutMs || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/context/generate`;

  const body = {
    files: files.map((f) => ({
      fileId: f.fileId,
      versionId: f.versionId,
      fileName: f.fileName,
      fileFormat: f.fileFormat,
      ...(f.dataFormat && { dataFormat: f.dataFormat }),
    })),
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
  return (await response.json()) as GenerateContextResult;
}
