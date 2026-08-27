import {
  resolveAliasLocale,
  resolveCanonicalLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import {
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
  getTranslationJobInfo,
  pollJobs,
  processBatches,
  processFileMoves,
  publishFiles,
  submitUserEditDiffs,
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
  type UploadSourceFilesData,
  type UploadTranslationsData,
} from 'generaltranslation/api';
import { defaultBaseUrl, unwrapApiResult } from 'generaltranslation/internal';

let client = createApiClient({ baseUrl: defaultBaseUrl });
let customMapping: CustomMapping | undefined;

export function configureApiClient(
  config: ApiClientConfig & { customMapping?: CustomMapping }
): void {
  const { customMapping: mapping, ...clientConfig } = config;
  client = createApiClient(clientConfig);
  customMapping = mapping;
}

function batchCount(items: readonly unknown[]): number {
  return Math.ceil(items.length / DEFAULT_BATCH_SIZE);
}

export const api = {
  async queryBranchData(body: GetBranchInfoData['body']) {
    return unwrapApiResult(await getBranchInfo({ body, client }));
  },

  async createBranch(body: CreateBranchData['body']) {
    return unwrapApiResult(await createBranch({ body, client }));
  },

  async queryFileData(body: GetFileInfoData['body']) {
    const result = unwrapApiResult(
      await getFileInfo({
        body: {
          ...body,
          translatedFiles: body.translatedFiles?.map((file) => ({
            ...file,
            locale: resolveCanonicalLocale(file.locale, customMapping),
          })),
        },
        client,
      })
    );
    return {
      ...result,
      translatedFiles: result.translatedFiles.map((file) => ({
        ...file,
        locale: resolveAliasLocale(file.locale, customMapping),
      })),
      sourceFiles: result.sourceFiles.map((file) => ({
        ...file,
        sourceLocale: resolveAliasLocale(file.sourceLocale, customMapping),
        locales: file.locales.map((locale) =>
          resolveAliasLocale(locale, customMapping)
        ),
      })),
    };
  },

  async checkJobStatus(jobIds: string[]) {
    return unwrapApiResult(
      await getTranslationJobInfo({ body: { jobIds }, client })
    );
  },

  resolveAliasLocale(locale: string) {
    return resolveAliasLocale(locale, customMapping);
  },

  async downloadFileBatch(files: DownloadFilesData['body']) {
    if (files.length === 0) return { files: [], count: 0, pending: [] };

    const request = async (batch: DownloadFilesData['body']) =>
      unwrapApiResult(
        await downloadFiles({
          body: batch.map((file) => ({
            ...file,
            locale: file.locale
              ? resolveCanonicalLocale(file.locale, customMapping)
              : undefined,
          })),
          client,
        })
      );
    const responses = await processBatches(files, async (batch) => [
      await request(batch),
    ]);
    return {
      files: responses.flatMap((response) =>
        response.files.map((file) => ({
          ...file,
          ...(file.locale && {
            locale: resolveAliasLocale(file.locale, customMapping),
          }),
          data: decodeFileContent(file.data, file.fileFormat),
        }))
      ),
      count: responses.reduce((count, response) => count + response.count, 0),
      pending: responses.flatMap((response) => response.pending ?? []),
    };
  },

  async publishFiles(files: PublishFilesData['body']['files']) {
    return unwrapApiResult(await publishFiles({ body: { files }, client }));
  },

  async submitUserEditDiffs(body: SubmitUserEditDiffsData['body']) {
    return processBatches(body.diffs, async (diffs) => [
      unwrapApiResult(
        await submitUserEditDiffs({
          body: {
            projectId: body.projectId,
            diffs: diffs.map((diff) => ({
              ...diff,
              locale: resolveCanonicalLocale(diff.locale, customMapping),
            })),
          },
          client,
        })
      ),
    ]);
  },

  async createTag(body: CreateTagData['body']) {
    return unwrapApiResult(await createTag({ body, client }));
  },

  async createProject(body: CreateProjectData['body']) {
    return unwrapApiResult(
      await createProject({
        body: {
          ...body,
          defaultLocale: resolveCanonicalLocale(
            body.defaultLocale,
            customMapping
          ),
        },
        client,
      })
    );
  },

  async getSetupStatus(jobId: string) {
    const statuses = unwrapApiResult(
      await getTranslationJobInfo({ body: { jobIds: [jobId] }, client })
    );
    return (
      statuses.find((status) => status.jobId === jobId) ?? {
        jobId,
        status: 'unknown' as const,
      }
    );
  },

  async getOrphanedFiles(branchId: string, fileIds: string[]) {
    const request = async (batch: string[]) =>
      unwrapApiResult(
        await getOrphanedFiles({
          body: { branchId, fileIds: batch },
          client,
        })
      );

    if (fileIds.length === 0) return request([]);

    const results = await processBatches(fileIds, async (batch) => [
      await request(batch),
    ]);
    // A file is orphaned only if every batch (which each sees a subset of
    // fileIds) reports it orphaned — intersect across batches.
    let orphanedFiles = results[0].orphanedFiles;
    for (const result of results.slice(1)) {
      const batchFileIds = new Set(
        result.orphanedFiles.map((file) => file.fileId)
      );
      orphanedFiles = orphanedFiles.filter((file) =>
        batchFileIds.has(file.fileId)
      );
    }
    return { orphanedFiles };
  },

  async processFileMoves(
    moves: ProcessFileMovesData['body']['moves'],
    options: Pick<ProcessFileMovesData['body'], 'branchId'>
  ) {
    const result = await processBatches(moves, async (batch) => {
      const response = unwrapApiResult(
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
    return unwrapApiResult(
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
    // Poll through unwrapApiResult so HTTP failures throw ApiError with the
    // status code instead of the decoded response body.
    return pollJobs(
      jobIds,
      async (pendingJobIds, signal) =>
        unwrapApiResult(
          await getTranslationJobInfo({
            body: { jobIds: pendingJobIds },
            client,
            signal,
          })
        ),
      options
    );
  },

  async enqueueFiles(
    files: EnqueueFileTranslationsData['body']['files'],
    options: {
      sourceLocale?: string;
      targetLocales: string[];
      modelProvider?: string;
      force?: boolean;
    }
  ) {
    const targetLocales = options.targetLocales.map((locale) =>
      resolveCanonicalLocale(locale, customMapping)
    );
    type CurrentResponse = Extract<
      EnqueueFileTranslationsResponse,
      { jobData: unknown }
    >;
    const result = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
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
      const response = unwrapApiResult(
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

    return { uploadedFiles: result };
  },

  async uploadTranslations(
    files: UploadTranslationsData['body']['data'],
    options: { sourceLocale: string; modelProvider?: string }
  ) {
    const result = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await uploadTranslations({
          body: {
            data: batch.map(({ source, translations }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
              },
              translations: translations.map((translation) => ({
                ...translation,
                locale: resolveCanonicalLocale(
                  translation.locale,
                  customMapping
                ),
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

    return { uploadedFiles: result };
  },
};

export type ApiClient = typeof api;
