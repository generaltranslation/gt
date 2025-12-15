import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import generateRequestHeaders from './utils/generateRequestHeaders';

export type CreateBranchQuery = {
  branchName: string;
  defaultBranch: boolean;
};

export type CreateBranchResult = {
  branch: { id: string; name: string };
};

/**
 * @internal
 * Creates a new branch in the API.
 * @param query - Object mapping the branch name and default branch flag
 * @param config - The configuration for the API call
 * @returns The created branch information
 */
export default async function _createBranch(
  query: CreateBranchQuery,
  config: TranslationRequestConfig
): Promise<CreateBranchResult> {
  const timeout = defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/branches/create`;

  // Request the creation of the branch
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
  return result as CreateBranchResult;
}
