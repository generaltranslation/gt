import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';

export type PublishFileEntry = {
  fileId: string;
  versionId: string;
  branchId?: string;
  publish: boolean;
  fileName?: string;
};

export type PublishFilesResult = {
  results: {
    fileId: string;
    versionId: string;
    // Present for translation files; omitted for source files.
    locale?: string;
    branchId: string;
    success: boolean;
    error?: string;
  }[];
};

/**
 * @internal
 * Publishes or unpublishes files on the CDN.
 * @param files - File entries with publish flags.
 * @param config - The configuration for the API call.
 * @returns The result of the API call.
 */
export default async function _publishFiles(
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
