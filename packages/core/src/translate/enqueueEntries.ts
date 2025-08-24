import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';
import {
  Updates,
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from '../types-dir/enqueueEntries';
import generateRequestHeaders from './utils/generateRequestHeaders';

/**
 * @internal
 * Sends translation entries to the General Translation API for enqueueing.
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 * @deprecated Use the {@link _enqueueFiles} method instead. Will be removed in v8.0.0.
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
      ...(options.modelProvider && { modelProvider: options.modelProvider }),
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
  await validateResponse(response);

  // Parse response
  const result = await response.json();
  return result as EnqueueEntriesResult;
}
