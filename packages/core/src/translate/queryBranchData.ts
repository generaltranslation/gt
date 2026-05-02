import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
import type { BranchDataResult } from '../types-dir/api/branch';

export type BranchQuery = {
  branchNames: string[];
};

/**
 * @internal
 * Queries branch information from the API.
 * @param query - Branch names to query.
 * @param config - The configuration for the API call.
 * @returns The branch information.
 */
export default async function _queryBranchData(
  query: BranchQuery,
  config: TranslationRequestConfig
): Promise<BranchDataResult> {
  return apiRequest<BranchDataResult>(config, '/v2/project/branches/info', {
    body: query,
  });
}
