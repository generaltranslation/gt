import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../translate/utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from '../translate/utils/validateResponse';
import handleFetchError from '../translate/utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import generateRequestHeaders from '../translate/utils/generateRequestHeaders';
import { ProjectData } from '../types-dir/project';

/**
 * @internal
 * Gets the project data for a given project ID.
 * @param projectId - The project ID to get the project data for
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The project data for the given project ID
 */
export default async function _getProjectData(
  projectId: string,
  options: { timeout?: number },
  config: TranslationRequestConfig
): Promise<ProjectData> {
  const { baseUrl } = config;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || defaultBaseUrl}/v2/project/info/${encodeURIComponent(projectId)}`;

  // Get the project data
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

  // Validate the response
  await validateResponse(response);

  const result = await response.json();
  return result as ProjectData;
}
