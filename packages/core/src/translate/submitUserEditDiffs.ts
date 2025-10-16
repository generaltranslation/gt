import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

export type SubmitUserEditDiff = {
  fileName: string;
  locale: string;
  diff: string;
  versionId?: string;
  fileId?: string;
};

export type SubmitUserEditDiffsPayload = {
  projectId?: string;
  diffs: SubmitUserEditDiff[];
};

/**
 * @internal
 * Submits user edit diffs so the service can learn/persist user-intended rules.
 */
export default async function _submitUserEditDiffs(
  payload: SubmitUserEditDiffsPayload,
  config: TranslationRequestConfig,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/diffs`;

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(payload),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  await validateResponse(response);
  return { success: true };
}
