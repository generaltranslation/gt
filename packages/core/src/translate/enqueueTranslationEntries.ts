import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { DataFormat } from '../types/Content';
import { TranslationRequestConfig } from '../types';

// Types for the enqueueTranslationEntries function - matches CLI package structure
export type Updates = ({
  metadata: Record<string, unknown>;
} & (
  | {
      dataFormat: 'JSX';
      source: unknown; // JsxChildren from generaltranslation/internal
    }
  | {
      dataFormat: 'ICU';
      source: string;
    }
  | {
      dataFormat: 'I18NEXT';
      source: string;
    }
))[];

// ApiOptions type that matches sendUpdates interface more closely
export type ApiOptions = {
  timeout?: number;
  baseUrl?: string;
  apiKey?: string;
  projectId?: string;
  defaultLocale?: string;
  locales?: string[];
  dataFormat?: DataFormat;
  version?: string;
  description?: string;
  requireApproval?: boolean;
};

export type EnqueueTranslationEntriesResult = {
  versionId: string;
  locales: string[];
  message?: string;
  projectSettings?: {
    cdnEnabled: boolean;
  };
};

/**
 * @internal
 * Lightweight version of sendUpdates that abstracts out only the API fetch request.
 * Sends translation entries to the General Translation API for enqueueing.
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @param library - The library being used (for context)
 * @returns The versionId of the updated project
 */
export default async function _enqueueTranslationEntries(
  updates: Updates,
  options: ApiOptions,
  _library: string,
  config: TranslationRequestConfig
): Promise<EnqueueTranslationEntriesResult> {
  const { apiKey, projectId, defaultLocale, dataFormat } = options;
  const timeout = Math.min(config.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultRuntimeApiUrl}/v1/project/translations/update`;

  // Validation - basic config validation
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!config.apiKey && !apiKey) {
    throw new Error('API key is required');
  }

  const globalMetadata = {
    ...(projectId && { projectId }),
    ...(defaultLocale && { sourceLocale: defaultLocale }),
  };

  // Build request body - matches original sendUpdates structure
  const body = {
    updates,
    ...(options.locales && { locales: options.locales }),
    metadata: globalMetadata,
    ...(dataFormat && { dataFormat }),
    ...(options.version && { versionId: options.version }),
    ...(options.description && { description: options.description }),
    ...(options.requireApproval !== undefined && {
      requireApproval: options.requireApproval,
    }),
  };

  // Request the updates
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((apiKey || config.apiKey) && {
            'x-gt-api-key': apiKey || config.apiKey,
          }),
        },
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
