import {
  createApiClient,
  createBranch,
  createFileUploads,
  createOrgApiKey,
  createProject,
  createProjectApiKey,
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
  listOrgs,
  listProjects,
  paginate,
  pollJobs,
  processBatches,
  processFileMoves,
  publishFiles,
  putFileUpload,
  submitUserEditDiffs,
  updateFiles,
  uploadAssets,
  uploadSourceFileReferences,
  uploadSourceFiles,
  uploadTranslations,
  type ApiClientConfig,
  type AwaitJobsOptions,
  type CreateBranchData,
  type CreateOrgApiKeyData,
  type CreateProjectApiKeyData,
  type CreateProjectData,
  type CreateTagData,
  type DownloadFilesData,
  type FileFormat,
  type EnqueueFileTranslationsData,
  type GenerateProjectContextData,
  type GetBranchInfoData,
  type GetFileInfoData,
  type GetTranslationJobInfoResponse,
  type GetTranslationStatusData,
  type ProcessFileMovesData,
  type PublishFilesData,
  type SubmitUserEditDiffsData,
  type UpdateFilesData,
  type UploadAssetsData,
  type UploadSourceFilesData,
  type UploadSourceFilesResponse,
  type UploadTranslationsData,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { DownloadedFile } from '../types-dir/api/downloadFileBatch';
import type {
  TranslateManyEntry,
  TranslateOptions,
} from '../types-dir/api/entry';
import type { TranslateManyResult, TranslationResult } from '../types';
import { createDiagnosticMessage } from '../logging/diagnostics';
import {
  translate as translateWithConfig,
  translateMany as translateManyWithConfig,
} from '../translate/runtimeTranslate';
import {
  decodeBytes,
  decodedByteLength,
  decodeFileContent,
  encodeFileContent,
} from '../utils/base64';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';
import { validateFileFormatTransforms } from '../translate/utils/validateFileFormatTransform';
import { isModelProvider, supportedModelProviders } from './modelProvider';

// Which files stay on the legacy upload route; the rest go by reference. The
// route's frozen contract rejects inline content over 20MB per file, and
// Cloudflare rejects request bodies over 100MB.
const MAX_LEGACY_INLINE_FILE_BYTES = 20_000_000;
const MAX_INLINE_REQUEST_BYTES = 90 * 1024 * 1024;

function jsonByteLength(value: unknown): number {
  return value === undefined
    ? 0
    : new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** PUTs a source file's bytes, and its formatMetadata when it has any, to storage unless the project already has them, then uploads it by reference to both. */
async function uploadSourceFileReference(
  {
    content,
    formatMetadata,
    ...source
  }: UploadSourceFilesData['body']['data'][number]['source'],
  options: {
    client: ReturnType<typeof createApiClient>;
    projectId: string;
    sourceLocale: string;
    // The configured fetch, not the client's, which would send API credentials to storage.
    storageTransport: Pick<ApiClientConfig, 'fetch' | 'retryPolicy'>;
  }
): Promise<UploadSourceFilesResponse['uploadedFiles'][number]> {
  const { client, projectId, sourceLocale, storageTransport } = options;
  const stage = (bytes: Uint8Array<ArrayBuffer>, fileFormat: FileFormat) => ({
    bytes,
    fileFormat,
    sha256: bytesToHex(sha256(bytes)),
  });
  const file = stage(decodeBytes(content), source.fileFormat);
  const metadata =
    formatMetadata &&
    stage(new TextEncoder().encode(JSON.stringify(formatMetadata)), 'JSON');
  const staged = metadata ? [file, metadata] : [file];
  const { files: created } = unwrapApiResult(
    await createFileUploads({
      client,
      path: { projectId },
      body: {
        files: staged.map(({ sha256: hash, fileFormat, bytes }) => ({
          sha256: hash,
          fileFormat,
          size: bytes.byteLength,
        })),
      },
    })
  );
  await Promise.all(
    created.map(({ sha256: hash, upload }) => {
      const bytes = staged.find((item) => item.sha256 === hash)?.bytes;
      return upload && bytes && putFileUpload(upload, bytes, storageTransport);
    })
  );

  const {
    results: [result],
  } = unwrapApiResult(
    await uploadSourceFileReferences({
      client,
      path: { projectId },
      body: {
        data: [
          {
            source: {
              ...source,
              upload: { sha256: file.sha256 },
              ...(metadata && {
                formatMetadata: { upload: { sha256: metadata.sha256 } },
              }),
            },
          },
        ],
        sourceLocale,
      },
    })
  );
  if (result?.status !== 'succeeded') {
    throw new Error(
      createDiagnosticMessage({
        source: 'generaltranslation',
        severity: 'Error',
        whatHappened: `Source file \`${source.fileName}\` could not be uploaded`,
        details: result?.error,
      })
    );
  }
  const { status: _status, error: _error, code: _code, ...uploaded } = result;
  return uploaded;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

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
  let config: GtApiAdapterConfig | undefined;

  // Mapping resolves aliases; standardization also canonicalizes configured
  // spellings such as en-us before they cross the service boundary.
  function resolveServiceLocale(locale: string): string {
    return standardizeLocale(
      resolveCanonicalLocale(locale, config?.customMapping)
    );
  }

  // Upload responses echo the canonical locale; callers key lockfile entries
  // by the configured alias, so map it back before it leaves the adapter.
  function aliasUploadedFileLocale<T extends { locale?: string }>(file: T): T {
    return file.locale
      ? {
          ...file,
          locale: resolveAliasLocale(file.locale, config?.customMapping),
        }
      : file;
  }

  function getConfig(): GtApiAdapterConfig {
    if (!config) {
      throw new Error(
        'API client not configured — call configureApiClient first'
      );
    }
    return config;
  }

  function getClient(timeoutMs?: number): ReturnType<typeof createApiClient> {
    if (timeoutMs === undefined && client) return client;
    return createApiClient({ ...getConfig(), timeoutMs });
  }

  function configure(nextConfig: GtApiAdapterConfig): void {
    client = createApiClient(nextConfig);
    config = { ...nextConfig };
  }

  async function translate(
    source: TranslateManyEntry,
    options: string | TranslateOptions,
    timeoutMs?: number | false
  ) {
    return translateWithConfig(source, options, {
      ...getConfig(),
      ...(timeoutMs !== undefined && { timeoutMs }),
    });
  }

  function translateMany(
    sources: TranslateManyEntry[],
    options: string | TranslateOptions,
    timeoutMs?: number | false
  ): Promise<TranslateManyResult>;
  function translateMany(
    sources: Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeoutMs?: number | false
  ): Promise<Record<string, TranslationResult>>;
  async function translateMany(
    sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeoutMs?: number | false
  ): Promise<TranslateManyResult | Record<string, TranslationResult>> {
    return translateManyWithConfig(sources, options, {
      ...getConfig(),
      ...(timeoutMs !== undefined && { timeoutMs }),
    });
  }

  if (defaultConfig) configure(defaultConfig);

  // Raw service responses; the normalized adapter methods build on these and
  // compatibility facades (CLI) expose them unchanged.
  async function loadJobStatuses(
    jobIds: readonly string[],
    options: { signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<GetTranslationJobInfoResponse> {
    return unwrapApiResult(
      await getTranslationJobInfo({
        body: { jobIds: [...jobIds] },
        client: getClient(options.timeoutMs),
        signal: options.signal,
      })
    );
  }

  async function loadProjectInfo(projectId?: string, timeoutMs?: number) {
    const resolvedProjectId = projectId ?? getConfig().projectId;
    if (!resolvedProjectId) {
      throw new Error('Project ID is required to fetch project information');
    }
    return unwrapApiResult(
      await getProjectInfo({
        client: getClient(timeoutMs),
        path: { projectId: resolvedProjectId },
      })
    );
  }

  return {
    configure,
    getClient,

    resolveAliasLocale(locale: string) {
      return resolveAliasLocale(locale, config?.customMapping);
    },

    resolveCanonicalLocale(locale: string) {
      return resolveServiceLocale(locale);
    },

    translate,
    translateMany,

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
              resolveServiceLocale(locale)
            ),
            force: options.force,
          },
          client: getClient(options.timeoutMs),
        })
      );
    },

    loadJobStatuses,

    async checkJobStatus(jobIds: string[], timeoutMs?: number) {
      const statuses = await loadJobStatuses(jobIds, { timeoutMs });
      return statuses.map(normalizeJobStatus);
    },

    async awaitJobs(jobIds: readonly string[], options?: AwaitJobsOptions) {
      const result = await pollJobs(
        jobIds,
        (pendingJobIds, signal) => loadJobStatuses(pendingJobIds, { signal }),
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
        resolveServiceLocale(locale)
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
                ? resolveServiceLocale(options.sourceLocale)
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
      // Compatibility callers pass entries carrying fileName; map only the
      // contract fields so nothing outside the generated body reaches the wire.
      return unwrapApiResult(
        await publishFiles({
          body: {
            files: files.map(({ fileId, versionId, branchId, publish }) => ({
              fileId,
              versionId,
              branchId,
              publish,
            })),
          },
          client: getClient(),
        })
      );
    },

    /** Updates source files, or their translations when a file names a locale; each request of up to 100 files writes all or nothing. */
    async updateFiles(
      files: UpdateFilesData['body']['files'],
      options: { timeout?: number } = {}
    ) {
      const { projectId } = getConfig();
      if (!projectId) {
        throw new Error('Project ID is required to update files');
      }
      const updated = await processBatches(files, async (batch) => {
        const response = unwrapApiResult(
          await updateFiles({
            body: {
              files: batch.map((file) =>
                file.locale === undefined
                  ? file
                  : { ...file, locale: resolveServiceLocale(file.locale) }
              ),
            },
            path: { projectId },
            client: getClient(options.timeout),
          })
        );
        return response.files.map(aliasUploadedFileLocale);
      });
      return { files: updated };
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
              diffs: diffs.map(
                ({
                  diff,
                  branchId,
                  versionId,
                  fileId,
                  localContent,
                  locale,
                }) => ({
                  diff,
                  branchId,
                  versionId,
                  fileId,
                  localContent,
                  locale: resolveServiceLocale(locale),
                })
              ),
            },
            client: getClient(options.timeout),
          })
        ),
      ]);
    },

    async createProject(
      orgId: CreateProjectData['path']['orgId'],
      body: CreateProjectData['body']
    ) {
      return unwrapApiResult(
        await createProject({
          path: { orgId },
          body: {
            ...body,
            defaultLocale: resolveServiceLocale(body.defaultLocale),
          },
          client: getClient(),
        })
      );
    },

    /** Projects the signed-in user is a member of, or the API key is bound to. */
    async listProjects() {
      return collect(paginate(listProjects, { client: getClient() }));
    },

    /** Organizations the credentials can access; listing one does not grant project creation. */
    async listOrgs() {
      return collect(paginate(listOrgs, { client: getClient() }));
    },

    async createProjectApiKey(
      projectId: CreateProjectApiKeyData['path']['projectId'],
      body: CreateProjectApiKeyData['body']
    ) {
      return unwrapApiResult(
        await createProjectApiKey({
          path: { projectId },
          body,
          client: getClient(),
        })
      );
    },

    async createOrgApiKey(
      orgId: CreateOrgApiKeyData['path']['orgId'],
      body: CreateOrgApiKeyData['body']
    ) {
      return unwrapApiResult(
        await createOrgApiKey({
          path: { orgId },
          body,
          client: getClient(),
        })
      );
    },

    loadProjectInfo,

    async getProjectInfo(projectId?: string, timeoutMs?: number) {
      const result = await loadProjectInfo(projectId, timeoutMs);
      return {
        ...result,
        defaultLocale: resolveAliasLocale(
          result.defaultLocale,
          config?.customMapping
        ),
        currentLocales: result.currentLocales.map((locale) =>
          resolveAliasLocale(locale, config?.customMapping)
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
              locale: resolveServiceLocale(file.locale),
            })),
          },
          client: getClient(timeoutMs),
        })
      );
      return {
        ...result,
        translatedFiles: result.translatedFiles.map((file) => ({
          ...file,
          locale: resolveAliasLocale(file.locale, config?.customMapping),
        })),
        sourceFiles: result.sourceFiles.map((file) => ({
          ...file,
          sourceLocale: resolveAliasLocale(
            file.sourceLocale,
            config?.customMapping
          ),
          locales: file.locales.map((locale) =>
            resolveAliasLocale(locale, config?.customMapping)
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
          locale: resolveAliasLocale(translation.locale, config?.customMapping),
        })),
        sourceFile: {
          ...result.sourceFile,
          sourceLocale: resolveAliasLocale(
            result.sourceFile.sourceLocale,
            config?.customMapping
          ),
          locales: result.sourceFile.locales.map((locale) =>
            resolveAliasLocale(locale, config?.customMapping)
          ),
        },
      };
    },

    async downloadFileBatch(
      files: DownloadFilesData['body'],
      options: { timeout?: number } = {}
    ) {
      const request = async (batch: DownloadFilesData['body']) =>
        unwrapApiResult(
          await downloadFiles({
            body: batch.map((file) => ({
              ...file,
              locale: file.locale
                ? resolveServiceLocale(file.locale)
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
                locale: resolveAliasLocale(file.locale, config?.customMapping),
              }),
              data: decodeFileContent(file.data, file.fileFormat),
              metadata: file.metadata,
            })
          )
        ),
        count: responses.reduce((count, response) => count + response.count, 0),
        pending: responses.flatMap((response) =>
          (response.pending ?? []).map((file) => ({
            ...file,
            locale: resolveAliasLocale(file.locale, config?.customMapping),
          }))
        ),
      };
    },

    /** Sends each file inline while it and its request fit the legacy route's limits, otherwise PUTs its bytes to storage and uploads a reference to them. */
    async uploadSourceFiles(
      files: Array<{
        source: UploadSourceFilesData['body']['data'][number]['source'];
      }>,
      options: { sourceLocale: string; timeout?: number }
    ) {
      const sourceLocale = resolveServiceLocale(options.sourceLocale);
      const { projectId, fetch, retryPolicy } = getConfig();
      const result = await processBatches(files, async (batch) => {
        const client = getClient(options.timeout);
        let inlineBytes = 0;
        const sources = batch.map(({ source }) => {
          const content = encodeFileContent(source.content, source.fileFormat);
          const size = content.length + jsonByteLength(source.formatMetadata);
          const inline =
            !projectId ||
            (decodedByteLength(content) <= MAX_LEGACY_INLINE_FILE_BYTES &&
              inlineBytes + size <= MAX_INLINE_REQUEST_BYTES);
          if (inline) inlineBytes += size;
          return {
            inline,
            source: {
              ...source,
              content,
              locale: resolveServiceLocale(source.locale),
            },
          };
        });

        const inlineSources = sources.filter(({ inline }) => inline);
        const uploaded =
          inlineSources.length > 0
            ? unwrapApiResult(
                await uploadSourceFiles({
                  body: {
                    data: inlineSources.map(({ source }) => ({ source })),
                    sourceLocale,
                  },
                  client,
                })
              ).uploadedFiles
            : [];
        // One at a time, so only one large file's bytes are held at once.
        for (const { inline, source } of sources) {
          if (inline) continue;
          uploaded.push(
            await uploadSourceFileReference(source, {
              client,
              projectId: projectId!,
              sourceLocale,
              storageTransport: { fetch, retryPolicy },
            })
          );
        }
        return uploaded.map(aliasUploadedFileLocale);
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
                  locale: resolveServiceLocale(source.locale),
                },
                translations: translations.map((translation) => ({
                  ...translation,
                  locale: resolveServiceLocale(translation.locale),
                  content: encodeFileContent(
                    translation.content,
                    translation.fileFormat
                  ),
                })),
              })),
              sourceLocale: resolveServiceLocale(options.sourceLocale),
            },
            client: getClient(options.timeout),
          })
        );
        return response.uploadedFiles.map(aliasUploadedFileLocale);
      });

      return { uploadedFiles: result };
    },
  };
}

export type GtApiAdapter = ReturnType<typeof createGtApiAdapter>;
