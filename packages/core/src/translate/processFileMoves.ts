import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { defaultTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../types';

export type MoveMapping = {
  oldFileId: string;
  newFileId: string;
  newFileName: string;
};

export type MoveResult = {
  oldFileId: string;
  newFileId: string;
  success: boolean;
  newSourceFileId?: string;
  clonedTranslationsCount?: number;
  error?: string;
};

export type ProcessMovesResponse = {
  results: MoveResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
};

export type ProcessMovesOptions = {
  timeout?: number;
  branchId?: string;
};

/**
 * @internal
 * Processes file moves by cloning source files and translations with new fileIds.
 * Called when the CLI detects that files have been moved/renamed.
 * @param moves - Array of move mappings (old fileId to new fileId)
 * @param options - Options including branchId and timeout
 * @param config - The configuration for the API call
 * @returns Promise resolving to the move results
 */
export default async function _processFileMoves(
  moves: MoveMapping[],
  options: ProcessMovesOptions,
  config: TranslationRequestConfig
): Promise<ProcessMovesResponse> {
  if (moves.length === 0) {
    return {
      results: [],
      summary: { total: 0, succeeded: 0, failed: 0 },
    };
  }

  const timeout = options.timeout ?? defaultTimeout;
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/moves`;

  const body = {
    branchId: options.branchId,
    moves,
  };

  let response: Response | undefined;
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
  } catch (err) {
    handleFetchError(err, timeout);
  }

  await validateResponse(response);
  const result = (await response!.json()) as ProcessMovesResponse;

  return result;
}
