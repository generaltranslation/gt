import {
  createApiClient,
  createBranch,
  DEFAULT_BATCH_SIZE,
  downloadFiles,
  enqueueFileTranslations,
  generateProjectContext,
  getFileInfo,
  getTranslationJobInfo,
  pollJobs,
  processBatches,
  uploadSourceFiles,
  uploadTranslations,
  type ApiClientConfig,
  type AwaitJobsOptions,
  type CreateBranchData,
  type DownloadFilesData,
  type EnqueueFileTranslationsData,
  type GenerateProjectContextData,
  type GetFileInfoData,
  type UploadSourceFilesData,
  type UploadTranslationsData,
} from '@generaltranslation/api';
import {
  resolveAliasLocale,
  resolveCanonicalLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { DownloadedFile } from '../types-dir/api/downloadFileBatch';
import { decodeFileContent, encodeFileContent } from '../utils/base64';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';

export type GtApiAdapterConfig = ApiClientConfig & {
  customMapping?: CustomMapping;
};

export function createGtApiAdapter(defaultConfig?: ApiClientConfig) {
  let client = defaultConfig ? createApiClient(defaultConfig) : undefined;
  let configuredClientConfig = defaultConfig;
  let customMapping: CustomMapping | undefined;

  function getClient(): ReturnType<typeof createApiClient> {
    if (!client) {
      throw new Error(
        'API client not configured — call configureApiClient first'
      );
    }
    return client;
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

    async createBranch(body: CreateBranchData['body']) {
      return unwrapApiResult(await createBranch({ body, client: getClient() }));
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
          client: getClient(),
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
            client: getClient(),
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
              // OpenAPI currently types metadata as an open object; the API emits
              // JSON values here, matching DownloadedFile's public contract.
              metadata: file.metadata as DownloadedFile['metadata'],
            })
          )
        ),
        count: responses.reduce((count, response) => count + response.count, 0),
        pending: responses.flatMap((response) => response.pending ?? []),
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
          client: getClient(),
        })
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
              // Consumers intentionally accept custom model-provider strings beyond
              // the OpenAPI enum; preserve the existing wire behavior at this boundary.
              modelProvider:
                options.modelProvider as EnqueueFileTranslationsData['body']['modelProvider'],
              force: options.force,
            },
            client: getClient(),
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

    async uploadSourceFiles(
      files: Array<{
        source: UploadSourceFilesData['body']['data'][number]['source'];
      }>,
      options: { sourceLocale: string }
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
            client: getClient(),
          })
        );
        return response.uploadedFiles;
      });

      return { uploadedFiles: result };
    },

    async awaitJobs(jobIds: readonly string[], options?: AwaitJobsOptions) {
      return pollJobs(
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
    },

    async uploadTranslations(
      files: UploadTranslationsData['body']['data'],
      options: { sourceLocale: string }
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
            client: getClient(),
          })
        );
        return response.uploadedFiles;
      });

      return { uploadedFiles: result };
    },
  };
}

export type GtApiAdapter = ReturnType<typeof createGtApiAdapter>;
