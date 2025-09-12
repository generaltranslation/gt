import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

export type ContextJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type CheckContextStatusResult = {
  jobId: string;
  status: ContextJobStatus;
  error?: { message: string };
};

export type ShouldGenerateContextResult = {
  shouldGenerateContext: boolean;
};

export async function _checkContextStatus(
  jobId: string,
  config: TranslationRequestConfig,
  timeoutMs?: number
): Promise<CheckContextStatusResult> {
  const timeout = Math.min(timeoutMs || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/context/status/${encodeURIComponent(jobId)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config, true),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  await validateResponse(response);
  return (await response.json()) as CheckContextStatusResult;
}

export async function _shouldGenerateContext(
  config: TranslationRequestConfig
): Promise<ShouldGenerateContextResult> {
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/context/should-generate`;

  const response = await fetch(url, {
    method: 'GET',
    headers: generateRequestHeaders(config, true),
  });

  await validateResponse(response);
  return (await response.json()) as ShouldGenerateContextResult;
}