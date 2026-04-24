import { TranslationRequestConfig, EnqueueFilesResult } from '../types';
import apiRequest from './utils/apiRequest';
import type { FileReferenceIds } from '../types-dir/api/file';
import { processBatches } from './utils/batch';
import { validateFileFormatTransforms } from './utils/validateFileFormatTransform';

export type EnqueueOptions = {
  sourceLocale?: string;
  targetLocales: string[];
  requireApproval?: boolean;
  modelProvider?: string;
  force?: boolean;
  timeout?: number;
};

/**
 * @internal
 * Enqueues files for translation in the General Translation API.
 * @param files - References of files to translate (file content already uploaded)
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns The result of the API call
 */
export default async function _enqueueFiles(
  files: FileReferenceIds[],
  options: EnqueueOptions,
  config: TranslationRequestConfig
): Promise<EnqueueFilesResult> {
  validateFileFormatTransforms(files);

  const result = await processBatches(
    files,
    async (batch) => {
      const body = {
        files: batch.map((f) => ({
          branchId: f.branchId,
          fileId: f.fileId,
          versionId: f.versionId,
          fileName: f.fileName,
          formatTransform: f.formatTransform,
        })),
        targetLocales: options.targetLocales,
        sourceLocale: options.sourceLocale,
        requireApproval: options.requireApproval,
        modelProvider: options.modelProvider,
        force: options.force,
      };

      const apiResult = await apiRequest<EnqueueFilesResult>(
        config,
        '/v2/project/translations/enqueue',
        { body, timeout: options.timeout }
      );
      return Array.from(Object.entries(apiResult.jobData));
    },
    { batchSize: 100 }
  );
  // flatten the result
  const jobs = Object.fromEntries(
    result.data.map(([jobId, jobData]) => [jobId, jobData])
  );
  return {
    jobData: jobs,
    locales: options.targetLocales,
    message: `Successfully enqueued ${result.count} file translation jobs in ${result.batchCount} batch(es)`,
  };
}
