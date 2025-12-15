import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import generateRequestHeaders from './utils/generateRequestHeaders';
import type { BranchDataResult } from '../types-dir/api/branch';

export type BranchQuery = {
  branchNames: string[];
};

/**
 * @internal
 * Queries branch information from the API.
 * @param query - Object mapping the current branch and incoming branches
 * @param config - The configuration for the API call
 * @returns The branch information
 */
export default async function _queryBranchData(
  query: BranchQuery,
  config: TranslationRequestConfig
): Promise<BranchDataResult> {
  const timeout = defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/branches/info`;

  // Request the branch data
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config),
        body: JSON.stringify(query),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  // Parse response
  const result = await response.json();
  return result as BranchDataResult;
}
