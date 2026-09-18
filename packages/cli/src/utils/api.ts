import type { CustomMapping } from '@generaltranslation/format/types';
import type { ApiClientConfig } from 'generaltranslation/api';
import { createGtApiAdapter } from 'generaltranslation/internal';

const {
  configure: configureSharedApi,
  getClient: _getClient,
  getClientConfig: _getClientConfig,
  loadJobStatuses,
  loadProjectInfo,
  ...sharedApi
} = createGtApiAdapter();

export function configureApiClient(
  config: ApiClientConfig & { customMapping?: CustomMapping }
): void {
  configureSharedApi(config);
}

// CLI keeps the raw service views: unaliased project locales and nullable
// job errors, plus per-request cancellation for polling.
export const api = {
  ...sharedApi,

  async checkJobStatus(jobIds: string[], signal?: AbortSignal) {
    return loadJobStatuses(jobIds, { signal });
  },

  async getProjectInfo(timeoutMs: number) {
    return loadProjectInfo(undefined, timeoutMs);
  },
};

export type ApiClient = typeof api;
