import { resolveCanonicalLocale } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import {
  awaitJobs as awaitApiJobs,
  createApiClient,
  createBranch,
  createProject,
  createTag,
  decodeFileContent,
  DEFAULT_BATCH_SIZE,
  downloadFiles,
  encodeFileContent,
  enqueueFileTranslations,
  generateProjectContext,
  getBranchInfo,
  getFileInfo,
  getOrphanedFiles,
  getProjectContextGenerationStatus,
  getTranslationJobInfo,
  processBatches,
  processFileMoves,
  publishFiles,
  submitUserEditDiffs,
  translate,
  uploadSourceFiles,
  uploadTranslations,
  type ApiClientConfig,
  type AwaitJobsOptions,
  type CreateBranchData,
  type CreateProjectData,
  type CreateTagData,
  type DownloadFilesData,
  type EnqueueFileTranslationsData,
  type EnqueueFileTranslationsResponse,
  type GenerateProjectContextData,
  type GetBranchInfoData,
  type GetFileInfoData,
  type ProcessFileMovesData,
  type PublishFilesData,
  type SubmitUserEditDiffsData,
  type TranslateData,
  type UploadSourceFilesData,
  type UploadTranslationsData,
} from '@generaltranslation/api';
import { ApiError } from 'generaltranslation/errors';
import {
  defaultBaseUrl,
  validateFileFormatTransforms,
  type FileFormatTransformInput,
} from 'generaltranslation/internal';

let client = createApiClient({ baseUrl: defaultBaseUrl });
let customMapping: CustomMapping | undefined;

export function configureApiClient(
  config: ApiClientConfig & { customMapping?: CustomMapping }
): void {
  const { customMapping: mapping, ...clientConfig } = config;
  client = createApiClient(clientConfig);
  customMapping = mapping;
}

type ApiResult<T> = {
  data: T | undefined;
  error: unknown;
  response?: Response;
};

function isErrorResponse(error: unknown): error is { error: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'string'
  );
}

function batchCount(items: readonly unknown[]): number {
  return Math.ceil(items.length / DEFAULT_BATCH_SIZE);
}

function responseData<T>(result: ApiResult<T>): Exclude<T, undefined> {
  if (result.data !== undefined) {
    return result.data as Exclude<T, undefined>;
  }
  if (result.response && isErrorResponse(result.error)) {
    throw new ApiError(
      result.error.error,
      result.response.status,
      result.error.error
    );
  }
  throw result.error;
}

export const api = {
  async queryBranchData(body: GetBranchInfoData['body']) {
    return responseData(await getBranchInfo({ body, client }));
  },

  async createBranch(body: CreateBranchData['body']) {
    return responseData(await createBranch({ body, client }));
  },

  async queryFileData(body: GetFileInfoData['body']) {
    return responseData(await getFileInfo({ body, client }));
  },

  async checkJobStatus(jobIds: string[]) {
    return responseData(
      await getTranslationJobInfo({ body: { jobIds }, client })
    );
  },

  resolveAliasLocale(locale: string) {
    return resolveCanonicalLocale(locale, customMapping);
  },

  async downloadFileBatch(files: DownloadFilesData['body']) {
    const request = async (batch: DownloadFilesData['body']) =>
      responseData(await downloadFiles({ body: batch, client }));
    const responses =
      files.length === 0
        ? [await request([])]
        : await processBatches(files, async (batch) => [await request(batch)]);
    return {
      files: responses.flatMap((response) =>
        response.files.map((file) => ({
          ...file,
          data: decodeFileContent(file.data, file.fileFormat),
        }))
      ),
      count: responses.reduce((count, response) => count + response.count, 0),
      pending: responses.flatMap((response) => response.pending ?? []),
    };
  },

  async publishFiles(files: PublishFilesData['body']['files']) {
    return responseData(await publishFiles({ body: { files }, client }));
  },

  async submitUserEditDiffs(body: SubmitUserEditDiffsData['body']) {
    return processBatches(body.diffs, async (diffs) => [
      responseData(
        await submitUserEditDiffs({
          body: { projectId: body.projectId, diffs },
          client,
        })
      ),
    ]);
  },

  async createTag(body: CreateTagData['body']) {
    return responseData(await createTag({ body, client }));
  },

  async createProject(body: CreateProjectData['body']) {
    return responseData(await createProject({ body, client }));
  },

  async getSetupStatus(jobId: string) {
    return responseData(
      await getProjectContextGenerationStatus({ path: { jobId }, client })
    );
  },

  async translate(body: TranslateData['body']) {
    return responseData(await translate({ body, client }));
  },

  async getOrphanedFiles(branchId: string, fileIds: string[]) {
    const request = async (batch: string[]) =>
      responseData(
        await getOrphanedFiles({
          body: { branchId, fileIds: batch },
          client,
        })
      );

    if (fileIds.length === 0) return request([]);

    const results = await processBatches(fileIds, async (batch) => [
      await request(batch),
    ]);
    const orphanedFiles = new Map(
      results[0].orphanedFiles.map((file) => [file.fileId, file])
    );
    for (const result of results.slice(1)) {
      const batchFileIds = new Set(
        result.orphanedFiles.map((file) => file.fileId)
      );
      for (const fileId of orphanedFiles.keys()) {
        if (!batchFileIds.has(fileId)) orphanedFiles.delete(fileId);
      }
    }
    return { orphanedFiles: [...orphanedFiles.values()] };
  },

  async processFileMoves(
    moves: ProcessFileMovesData['body']['moves'],
    options: Pick<ProcessFileMovesData['body'], 'branchId'>
  ) {
    const result = await processBatches(moves, async (batch) => {
      const response = responseData(
        await processFileMoves({
          body: { branchId: options.branchId, moves: batch },
          client,
        })
      );
      return response.results;
    });
    const succeeded = result.filter(({ success }) => success).length;

    return {
      results: result,
      summary: {
        total: moves.length,
        succeeded,
        failed: result.length - succeeded,
      },
    };
  },

  async setupProject(
    files: GenerateProjectContextData['body']['files'],
    options: Omit<GenerateProjectContextData['body'], 'files'> = {}
  ) {
    return responseData(
      await generateProjectContext({
        body: {
          files: files.map(({ branchId, fileId, versionId }) => ({
            branchId,
            fileId,
            versionId,
          })),
          locales: options.locales?.map((locale) =>
            resolveCanonicalLocale(locale, customMapping)
          ),
          force: options.force,
        },
        client,
      })
    );
  },

  async awaitJobs(jobIds: readonly string[], options?: AwaitJobsOptions) {
    return awaitApiJobs(client, jobIds, options);
  },

  async enqueueFiles(
    files: Array<
      EnqueueFileTranslationsData['body']['files'][number] &
        FileFormatTransformInput
    >,
    options: {
      sourceLocale?: string;
      targetLocales: string[];
      modelProvider?: string;
      force?: boolean;
    }
  ) {
    validateFileFormatTransforms(files);
    const targetLocales = options.targetLocales.map((locale) =>
      resolveCanonicalLocale(locale, customMapping)
    );
    type CurrentResponse = Extract<
      EnqueueFileTranslationsResponse,
      { jobData: unknown }
    >;
    const result = await processBatches(files, async (batch) => {
      const response = responseData(
        await enqueueFileTranslations({
          body: {
            files: batch.map(
              ({ branchId, fileId, versionId, fileName, transformFormat }) => ({
                branchId,
                fileId,
                versionId,
                fileName,
                transformFormat,
              })
            ),
            targetLocales,
            sourceLocale: options.sourceLocale,
            modelProvider:
              options.modelProvider as EnqueueFileTranslationsData['body']['modelProvider'],
            force: options.force,
          },
          client,
        })
      ) as CurrentResponse;
      return Object.entries(response.jobData);
    });

    return {
      jobData: Object.fromEntries(result),
      locales: targetLocales,
      message: `Successfully enqueued ${result.length} file translation jobs in ${batchCount(files)} batch(es)`,
    };
  },

  async uploadSourceFiles(
    files: Array<{
      source: UploadSourceFilesData['body']['data'][number]['source'];
    }>,
    options: { sourceLocale: string; modelProvider?: string }
  ) {
    const sourceLocale = resolveCanonicalLocale(
      options.sourceLocale,
      customMapping
    );
    const result = await processBatches(files, async (batch) => {
      const response = responseData(
        await uploadSourceFiles({
          body: {
            data: batch.map(({ source }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
                locale: resolveCanonicalLocale(source.locale, customMapping),
              },
            })),
            sourceLocale,
          },
          client,
        })
      );
      return response.uploadedFiles;
    });

    return {
      uploadedFiles: result,
      count: result.length,
      message: `Successfully uploaded ${result.length} files in ${batchCount(files)} batch(es)`,
    };
  },

  async uploadTranslations(
    files: UploadTranslationsData['body']['data'],
    options: { sourceLocale: string; modelProvider?: string }
  ) {
    const result = await processBatches(files, async (batch) => {
      const response = responseData(
        await uploadTranslations({
          body: {
            data: batch.map(({ source, translations }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
              },
              translations: translations.map((translation) => ({
                ...translation,
                content: encodeFileContent(
                  translation.content,
                  translation.fileFormat
                ),
              })),
            })),
            sourceLocale: resolveCanonicalLocale(
              options.sourceLocale,
              customMapping
            ),
          },
          client,
        })
      );
      return response.uploadedFiles;
    });

    return {
      uploadedFiles: result,
      count: result.length,
      message: `Successfully uploaded ${result.length} files in ${batchCount(files)} batch(es)`,
    };
  },
};

export type ApiClient = typeof api;
