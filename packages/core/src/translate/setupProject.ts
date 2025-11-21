import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
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
  const timeout = Math.min(options?.timeoutMs ?? maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/setup/generate`;

  const body = {
    files: files.map((f) => ({
      branchId: f.branchId,
      fileId: f.fileId,
      versionId: f.versionId,
    })),
    locales: options?.locales,
    force: options?.force,
  };

  let response;
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
  return (await response.json()) as SetupProjectResult;
}
