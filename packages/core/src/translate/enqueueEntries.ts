import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import validateConfig from './utils/validateConfig';
import {
  Updates,
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from '../_types/enqueue';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Lightweight version of sendUpdates that abstracts out only the API fetch request.
 * Sends translation entries to the General Translation API for enqueueing.
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @param config - The configuration for the API calls
 * @returns The versionId of the updated project
 */
export default async function _enqueueEntries(
  updates: Updates,
  options: EnqueueEntriesOptions,
  config: TranslationRequestConfig
): Promise<EnqueueEntriesResult> {
  const { apiKey, projectId } = config;
  const {
    sourceLocale,
    dataFormat,
    targetLocales,
    version,
    description,
    requireApproval,
  } = options;
  const timeout = Math.min(config.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/translations/update`;

  // Validation
  validateConfig(config);

  const globalMetadata = {
    ...(projectId && { projectId }),
    ...(sourceLocale && { sourceLocale }),
  };

  // Build request body - matches original sendUpdates structure
  const body = {
    updates,
    ...(targetLocales && { locales: targetLocales }),
    metadata: globalMetadata,
    ...(dataFormat && { dataFormat }),
    ...(version && { versionId: version }),
    ...(description && { description }),
    ...(requireApproval !== undefined && {
      requireApproval,
    }),
  };

  // Request the updates
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

  // Validate response
  await validateResponse(response!);

  // Parse response
  const { versionId, message, locales, projectSettings } =
    (await response!.json()) as {
      versionId: string;
      message?: string;
      locales: string[];
      projectSettings?: {
        cdnEnabled: boolean;
      };
    };

  return { versionId, locales, message, projectSettings };
}
