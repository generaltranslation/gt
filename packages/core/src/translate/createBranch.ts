import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';

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
  return apiRequest<CreateBranchResult>(config, '/v2/project/branches/create', {
    body: query,
  });
}
