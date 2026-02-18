import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
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
  await processBatches(
    payload.diffs,
    async (batch) => {
      await apiRequest(config, '/v2/project/files/diffs', {
        body: { diffs: batch } satisfies SubmitUserEditDiffsPayload,
        timeout: options.timeout,
      });
      return [{ success: true }];
    },
    { batchSize: 100 }
  );

  return { success: true };
}
