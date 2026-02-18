import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
import { processBatches } from './utils/batch';

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

  const batchResult = await processBatches(
    moves,
    async (batch) => {
      const result = await apiRequest<ProcessMovesResponse>(
        config,
        '/v2/project/files/moves',
        {
          body: { branchId: options.branchId, moves: batch },
          timeout: options.timeout,
        }
      );
      return result.results;
    },
    { batchSize: 100 }
  );

  const succeeded = batchResult.data.filter((r) => r.success).length;
  const failed = batchResult.data.filter((r) => !r.success).length;

  return {
    results: batchResult.data,
    summary: {
      total: moves.length,
      succeeded,
      failed,
    },
  };
}
