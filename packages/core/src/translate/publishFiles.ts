import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';

// Compatibility input: fileName is retained for published callers even though
// the generated request ignores it.
export type PublishFileEntry = {
  fileId: string;
  versionId: string;
  branchId?: string;
  publish: boolean;
  fileName?: string;
};

export type PublishFilesResult =
  import('@generaltranslation/api').PublishFilesResponse;

/**
 * @internal
 * Publishes or unpublishes files on the CDN.
 * @param files - Array of file entries with publish flags
 * @param config - The configuration for the API call.
 * @returns The result of the API call.
 */
export async function _publishFiles(
  files: PublishFileEntry[],
  config: TranslationRequestConfig
): Promise<PublishFilesResult> {
  return await apiRequest<PublishFilesResult>(
    config,
    '/v2/project/files/publish',
    {
      body: { files },
    }
  );
}
