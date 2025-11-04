import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  CheckFileTranslationsOptions,
  FileQueryResult,
} from '../types-dir/api/checkFileTranslations';
import { FileQuery } from '../types-dir/api/checkFileTranslations';
import generateRequestHeaders from './utils/generateRequestHeaders';

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
  const { baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const versionId = query.versionId;
  const fileId = query.fileId;
  const url = `${baseUrl || defaultBaseUrl}/v2/project/translations/files/status/${encodeURIComponent(fileId)}${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`;

  // Request the file download
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: generateRequestHeaders(config, true),
      },
      timeout
    );
  } catch (error) {
    handleFetchError(error, timeout);
  }

  // Validate response
  await validateResponse(response);

  const result = await response.json();
  return result as FileQueryResult;
}
