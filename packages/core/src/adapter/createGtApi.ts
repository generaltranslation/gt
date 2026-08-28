import {
  createApiClient,
  createBranch,
  createTag,
  DEFAULT_BATCH_SIZE,
  downloadFiles,
  enqueueFileTranslations,
  generateProjectContext,
  getBranchInfo,
  getFileInfo,
  getOrphanedFiles,
  getProjectInfo,
  getTranslationJobInfo,
  getTranslationStatus,
  pollJobs,
  processBatches,
  processFileMoves,
  publishFiles,
  submitUserEditDiffs,
  uploadAssets,
  uploadSourceFiles,
  uploadTranslations,
  type ApiClientConfig,
  type AwaitJobsOptions,
  type CreateBranchData,
  type CreateTagData,
  type DownloadFilesData,
  type EnqueueFileTranslationsData,
  type GenerateProjectContextData,
  type GetBranchInfoData,
  type GetFileInfoData,
  type GetTranslationJobInfoResponse,
  type GetTranslationStatusData,
  type ProcessFileMovesData,
  type PublishFilesData,
  type SubmitUserEditDiffsData,
  type UploadAssetsData,
  type UploadSourceFilesData,
  type UploadTranslationsData,
} from '@generaltranslation/api';
import {
  resolveAliasLocale,
  resolveCanonicalLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { DownloadedFile } from '../types-dir/api/downloadFileBatch';
import { createDiagnosticMessage } from '../logging/diagnostics';
import { decodeFileContent, encodeFileContent } from '../utils/base64';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';
import { validateFileFormatTransforms } from '../translate/utils/validateFileFormatTransform';
import { isModelProvider, supportedModelProviders } from './modelProvider';

function normalizeJobStatus(job: GetTranslationJobInfoResponse[number]): {
  jobId: string;
  status: GetTranslationJobInfoResponse[number]['status'];
  error?: { message: string };
} {
  return {
    jobId: job.jobId,
    status: job.status,
    ...(job.status === 'failed'
      ? { error: { message: job.error.message ?? '' } }
      : {}),
  };
}

export type GtApiAdapterConfig = ApiClientConfig & {
  customMapping?: CustomMapping;
};

export function createGtApiAdapter(defaultConfig?: GtApiAdapterConfig) {
  let client: ReturnType<typeof createApiClient> | undefined;
  let configuredClientConfig: ApiClientConfig | undefined;
  let customMapping: CustomMapping | undefined;

  function getClient(timeoutMs?: number): ReturnType<typeof createApiClient> {
    if (!client) {
      throw new Error(
        'API client not configured — call configureApiClient first'
      );
    }
    return timeoutMs
      ? createApiClient({ ...getClientConfig(), timeoutMs })
      : client;
  }

  function getClientConfig(): ApiClientConfig {
    if (!configuredClientConfig) {
      throw new Error(
        'API client not configured — call configureApiClient first'
      );
    }
    return configuredClientConfig;
  }

  function configure(config: GtApiAdapterConfig): void {
    const { customMapping: mapping, ...clientConfig } = config;
    client = createApiClient(clientConfig);
    configuredClientConfig = clientConfig;
    customMapping = mapping;
  }

  if (defaultConfig) configure(defaultConfig);

  return {
    configure,
    getClient,
    getClientConfig,

    resolveAliasLocale(locale: string) {
      return resolveAliasLocale(locale, customMapping);
    },

    resolveCanonicalLocale(locale: string) {
      return resolveCanonicalLocale(locale, customMapping);
    },

    async queryBranchData(body: GetBranchInfoData['body']) {
      return unwrapApiResult(
        await getBranchInfo({ body, client: getClient() })
      );
    },

    async createBranch(body: CreateBranchData['body']) {
      return unwrapApiResult(await createBranch({ body, client: getClient() }));
    },

    async processFileMoves(
      moves: ProcessFileMovesData['body']['moves'],
      options: Pick<ProcessFileMovesData['body'], 'branchId'> & {
        timeout?: number;
      } = {}
    ) {
      const results = await processBatches(moves, async (batch) => {
        const response = unwrapApiResult(
          await processFileMoves({
            body: { branchId: options.branchId, moves: batch },
            client: getClient(options.timeout),
          })
        );
        return response.results;
      });
      const succeeded = results.filter(({ success }) => success).length;
      return {
        results,
        summary: {
          total: moves.length,
          succeeded,
          failed: results.length - succeeded,
        },
      };
    },

    async getOrphanedFiles(
      branchId: string,
      fileIds: string[],
      options: { timeout?: number } = {}
    ) {
      const request = async (batch: string[]) =>
        unwrapApiResult(
          await getOrphanedFiles({
            body: { branchId, fileIds: batch },
            client: getClient(options.timeout),
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
        for (const fileId of Array.from(orphanedFiles.keys())) {
          if (!batchFileIds.has(fileId)) orphanedFiles.delete(fileId);
        }
      }
      return { orphanedFiles: Array.from(orphanedFiles.values()) };
    },

    async setupProject(
      files: GenerateProjectContextData['body']['files'],
      options: Omit<GenerateProjectContextData['body'], 'files'> & {
        timeoutMs?: number;
      } = {}
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
          client: getClient(options.timeoutMs),
        })
      );
    },

    async checkJobStatus(jobIds: string[], timeoutMs?: number) {
      const statuses = unwrapApiResult(
        await getTranslationJobInfo({
          body: { jobIds },
          client: getClient(timeoutMs),
        })
      );
      return statuses.map(normalizeJobStatus);
    },

    async awaitJobs(jobIds: readonly string[], options?: AwaitJobsOptions) {
      const result = await pollJobs(
        jobIds,
        async (pendingJobIds, signal) =>
          unwrapApiResult(
            await getTranslationJobInfo({
              body: { jobIds: pendingJobIds },
              client: getClient(),
              signal,
            })
          ),
        options
      );
      return {
        ...result,
        jobs: result.jobs.map(normalizeJobStatus),
      };
    },

    async enqueueFiles(
      files: EnqueueFileTranslationsData['body']['files'],
      options: {
        sourceLocale?: string;
        targetLocales: string[];
        modelProvider?: string;
        force?: boolean;
        timeout?: number;
      }
    ) {
      validateFileFormatTransforms(files);
      const modelProvider = options.modelProvider;
      if (modelProvider !== undefined && !isModelProvider(modelProvider)) {
        throw new Error(
          createDiagnosticMessage({
            source: 'generaltranslation',
            severity: 'Error',
            whatHappened: `Unsupported model provider \`${modelProvider}\``,
            fix: `Use one of: ${supportedModelProviders.join(', ')}`,
          })
        );
      }
      const targetLocales = options.targetLocales.map((locale) =>
        resolveCanonicalLocale(locale, customMapping)
      );
      const result = await processBatches(files, async (batch) => {
        const response = unwrapApiResult(
          await enqueueFileTranslations({
            body: {
              files: batch.map(
                ({
                  branchId,
                  fileId,
                  versionId,
                  fileName,
                  transformFormat,
                }) => ({
                  branchId,
                  fileId,
                  versionId,
                  fileName,
                  transformFormat,
                })
              ),
              targetLocales,
              sourceLocale: options.sourceLocale
                ? resolveCanonicalLocale(options.sourceLocale, customMapping)
                : undefined,
              modelProvider,
              force: options.force,
            },
            client: getClient(options.timeout),
          })
        );
        const jobData =
          'jobData' in response ? response.jobData : response.data;
        return Object.entries(jobData);
      });

      return {
        jobData: Object.fromEntries(result),
        locales: targetLocales,
        message: `Successfully enqueued ${result.length} file translation jobs in ${Math.ceil(files.length / DEFAULT_BATCH_SIZE)} batch(es)`,
      };
    },

    async createTag(body: CreateTagData['body']) {
      return unwrapApiResult(await createTag({ body, client: getClient() }));
    },

    async publishFiles(files: PublishFilesData['body']['files']) {
      return unwrapApiResult(
        await publishFiles({ body: { files }, client: getClient() })
      );
    },

    async submitUserEditDiffs(
      body: SubmitUserEditDiffsData['body'],
      options: { timeout?: number } = {}
    ) {
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
            client: getClient(options.timeout),
          })
        ),
      ]);
    },

    async getProjectInfo(projectId?: string, timeoutMs?: number) {
      const resolvedProjectId = projectId ?? getClientConfig().projectId;
      if (!resolvedProjectId) {
        throw new Error('Project ID is required to fetch project information');
      }
      const result = unwrapApiResult(
        await getProjectInfo({
          client: getClient(timeoutMs),
          path: { projectId: resolvedProjectId },
        })
      );
      return {
        ...result,
        defaultLocale: result.defaultLocale
          ? resolveAliasLocale(result.defaultLocale, customMapping)
          : result.defaultLocale,
        currentLocales: result.currentLocales.map((locale) =>
          resolveAliasLocale(locale, customMapping)
        ),
      };
    },

    async queryFileData(body: GetFileInfoData['body'], timeoutMs?: number) {
      const result = unwrapApiResult(
        await getFileInfo({
          body: {
            ...body,
            translatedFiles: body.translatedFiles?.map((file) => ({
              ...file,
              locale: resolveCanonicalLocale(file.locale, customMapping),
            })),
          },
          client: getClient(timeoutMs),
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

    async querySourceFile(
      path: GetTranslationStatusData['path'],
      query: GetTranslationStatusData['query'] = {},
      timeoutMs?: number
    ) {
      const result = unwrapApiResult(
        await getTranslationStatus({
          path,
          query,
          client: getClient(timeoutMs),
        })
      );
      return {
        ...result,
        translations: result.translations.map((translation) => ({
          ...translation,
          locale: resolveAliasLocale(translation.locale, customMapping),
        })),
        sourceFile: {
          ...result.sourceFile,
          sourceLocale: resolveAliasLocale(
            result.sourceFile.sourceLocale,
            customMapping
          ),
          locales: result.sourceFile.locales.map((locale) =>
            resolveAliasLocale(locale, customMapping)
          ),
        },
      };
    },

    async downloadFileBatch(
      files: DownloadFilesData['body'],
      options: { timeout?: number } = {}
    ) {
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
            client: getClient(options.timeout),
          })
        );
      const responses = await processBatches(files, async (batch) => [
        await request(batch),
      ]);
      return {
        files: responses.flatMap((response) =>
          response.files.map(
            (file): DownloadedFile => ({
              ...file,
              ...(file.locale && {
                locale: resolveAliasLocale(file.locale, customMapping),
              }),
              data: decodeFileContent(file.data, file.fileFormat),
              metadata: file.metadata,
            })
          )
        ),
        count: responses.reduce((count, response) => count + response.count, 0),
        pending: responses.flatMap((response) => response.pending ?? []),
      };
    },

    async uploadSourceFiles(
      files: Array<{
        source: UploadSourceFilesData['body']['data'][number]['source'];
      }>,
      options: { sourceLocale: string; timeout?: number }
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
            client: getClient(options.timeout),
          })
        );
        return response.uploadedFiles;
      });

      return { uploadedFiles: result };
    },

    async uploadFonts(
      fonts: UploadAssetsData['body']['assets'],
      options: { timeout?: number } = {}
    ) {
      const assets = await processBatches(
        fonts,
        async (batch) => {
          const result = unwrapApiResult(
            await uploadAssets({
              body: { assets: batch },
              client: getClient(options.timeout),
            })
          );
          return result.assets;
        },
        { batchSize: 50 }
      );
      return { assets, count: assets.length };
    },

    async uploadTranslations(
      files: UploadTranslationsData['body']['data'],
      options: { sourceLocale: string; timeout?: number }
    ) {
      validateFileFormatTransforms(files.map(({ source }) => source));
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
            client: getClient(options.timeout),
          })
        );
        return response.uploadedFiles;
      });

      return { uploadedFiles: result };
    },
  };
}

export type GtApiAdapter = ReturnType<typeof createGtApiAdapter>;
