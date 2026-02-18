import { TranslationRequestConfig } from '../types';
import {
  CheckFileTranslationsOptions,
  FileQueryResult,
} from '../types-dir/api/checkFileTranslations';
import { FileQuery } from '../types-dir/api/checkFileTranslations';
import apiRequest from './utils/apiRequest';

/**
 * @internal
 * Gets the source file and translation information for a given file ID and version ID.
 * @param query - The file ID and version ID to get the source file and translation information for
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The source file and translation information for the given file ID and version ID
 */
export default async function _querySourceFile(
  query: FileQuery,
  options: CheckFileTranslationsOptions,
  config: TranslationRequestConfig
): Promise<FileQueryResult> {
  const branchId = query.branchId;
  const versionId = query.versionId;
  const fileId = query.fileId;

  const searchParams = new URLSearchParams();
  if (branchId) {
    searchParams.set('branchId', branchId);
  }
  if (versionId) {
    searchParams.set('versionId', versionId);
  }
  const endpoint = `/v2/project/translations/files/status/${encodeURIComponent(fileId)}?${searchParams.toString()}`;

  return apiRequest<FileQueryResult>(config, endpoint, {
    method: 'GET',
    timeout: options.timeout,
  });
}
