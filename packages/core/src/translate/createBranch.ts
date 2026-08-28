import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';

// Compatibility input: defaultBranch remains required on the published method,
// while the generated request makes it optional.
export type CreateBranchQuery = {
  branchName: string;
  defaultBranch: boolean;
};

export type CreateBranchResult =
  import('@generaltranslation/api').CreateBranchResponse;

/**
 * @internal
 * Creates a new branch in the API.
 * @param query - Object mapping the branch name and default branch flag
 * @param config - The configuration for the API call.
 * @returns The created branch information.
 */
export async function _createBranch(
  query: CreateBranchQuery,
  config: TranslationRequestConfig
): Promise<CreateBranchResult> {
  return apiRequest<CreateBranchResult>(config, '/v2/project/branches/create', {
    body: query,
  });
}
