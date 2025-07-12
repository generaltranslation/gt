import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  Updates,
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from '../types-dir/enqueue';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Sends translation entries to the General Translation API for enqueueing.
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _enqueueEntries(
  updates: Updates,
  options: EnqueueEntriesOptions,
  config: TranslationRequestConfig
): Promise<EnqueueEntriesResult> {
  const { projectId } = config;
  const {
    sourceLocale,
    dataFormat,
    targetLocales,
    version,
    description,
    requireApproval,
  } = options;
  const timeout = Math.min(options.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v1/project/translations/update`;

  // Build request body - matches original sendUpdates structure
  const body = {
    updates,
    ...(targetLocales && { locales: targetLocales }),
    metadata: {
      ...(projectId && { projectId }),
      ...(sourceLocale && { sourceLocale }),
    },
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
