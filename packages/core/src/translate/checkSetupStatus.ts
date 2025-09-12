import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

export type SetupJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type CheckSetupStatusResult = {
  jobId: string;
  status: SetupJobStatus;
  error?: { message: string };
};

export async function _checkSetupStatus(
  jobId: string,
  config: TranslationRequestConfig,
  timeoutMs?: number
): Promise<CheckSetupStatusResult> {
  const timeout = Math.min(timeoutMs || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/setup/status/${encodeURIComponent(jobId)}`;

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
  return (await response.json()) as CheckSetupStatusResult;
}
