import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { processBatches } from './utils/batch';

export type SubmitUserEditDiff = {
  fileName: string;
  locale: string;
  diff: string;
  branchId: string;
  versionId: string;
  fileId: string;
  localContent: string;
};

export type SubmitUserEditDiffsPayload = {
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
  const timeout = options.timeout ? options.timeout : defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/diffs`;

  await processBatches(
    payload.diffs,
    async (batch) => {
      const body = { diffs: batch } satisfies SubmitUserEditDiffsPayload;

      let response: Response | undefined;
      try {
        response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: generateRequestHeaders(config),
            body: JSON.stringify(body),
          },
          timeout
        );
      } catch (error) {
        handleFetchError(error, timeout);
      }

      await validateResponse(response);
      return [{ success: true }];
    },
    { batchSize: 100 }
  );

  return { success: true };
}
