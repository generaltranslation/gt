import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
import type { FileReference } from '../types-dir/api/file';

export type SetupProjectResult =
  | { setupJobId: string; status: 'queued' }
  | { status: 'completed' };

export type SetupProjectOptions = {
  force?: boolean;
  locales?: string[];
  timeoutMs?: number;
};

/**
 * @internal
 * Enqueues files for project setup the General Translation API.
 * @param files - References of files to translate (file content already uploaded)
 * @param config - The configuration for the API call
 * @param timeoutMS - The timeout in milliseconds
 * @returns The result of the API call
 */
export default async function _setupProject(
  files: FileReference[],
  config: TranslationRequestConfig,
  options?: SetupProjectOptions
): Promise<SetupProjectResult> {
  return apiRequest<SetupProjectResult>(config, '/v2/project/setup/generate', {
    body: {
      files: files.map((f) => ({
        branchId: f.branchId,
        fileId: f.fileId,
        versionId: f.versionId,
      })),
      locales: options?.locales,
      force: options?.force,
    },
    timeout: options?.timeoutMs,
  });
}
