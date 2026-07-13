import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';

export type ProjectInfoResult = {
  id: string;
  name: string;
  orgId: string;
  defaultLocale: string;
  currentLocales: string[];
  autoApprove?: boolean;
};

export type GetProjectInfoOptions = {
  timeout?: number;
};

/**
 * @internal
 * Fetches project info (name, locales, review settings) for a project.
 * @param options - The options for the API call.
 * @param config - The configuration for the API call.
 * @returns The project info.
 */
export async function _getProjectInfo(
  options: GetProjectInfoOptions,
  config: TranslationRequestConfig
): Promise<ProjectInfoResult> {
  return apiRequest<ProjectInfoResult>(
    config,
    `/v2/project/info/${config.projectId}`,
    {
      method: 'GET',
      timeout: options.timeout,
    }
  );
}
