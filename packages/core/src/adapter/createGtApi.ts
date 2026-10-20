import {
  API_VERSION,
  ApiError,
  awaitJobs,
  createApiClient,
  createBranch,
  createProject,
  createProjectApiKey,
  DEFAULT_BATCH_SIZE,
  generateProjectContext,
  getFileContent,
  getFileStatus,
  getJob,
  getProject,
  listBranchFiles,
  listBranches,
  listOrgs,
  listProjects,
  moveFiles,
  overwriteTranslations,
  paginate,
  processBatches,
  publishFiles,
  queryFiles,
  queryFilesContent,
  queryJobsInBatches,
  setTag,
  translateFiles,
  updateBranch,
  updateProject,
  uploadSourceFiles,
  uploadTranslations,
  upsertAssets,
  type ApiClientConfig,
  type AwaitJobsOptions,
  type BatchWriteSummary,
  type CreateBranchData,
  type CreateBranchResponse,
  type CreateProjectApiKeyData,
  type CreateProjectData,
  type GenerateProjectContextData,
  type GetFileContentData,
  type GetFileStatusData,
  type GetProjectResponse,
  type ListBranchesData,
  type ListBranchFilesData,
  type MoveFilesData,
  type OverwriteTranslationsData,
  type PublishFilesData,
  type QueryFilesContentData,
  type QueryFilesData,
  type SetTagData,
  type TranslateFilesData,
  type UpdateBranchData,
  type UpdateProjectData,
  type UploadSourceFilesData,
  type UploadTranslationsData,
  type UpsertAssetsData,
} from '@generaltranslation/api';
import {
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
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
import { decodeFileContent, encodeFileContent } from '../utils/base64';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';
import { validateFileFormatTransforms } from '../translate/utils/validateFileFormatTransform';
import { isModelProvider, supportedModelProviders } from './modelProvider';

// Server caps per request; DEFAULT_BATCH_SIZE covers the operations capped at 100.
const MOVE_FILES_BATCH_SIZE = 25;
const UPSERT_ASSETS_BATCH_SIZE = 10;

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

type BatchWriteResponse<Result> = {
  summary: BatchWriteSummary;
  results: Result[];
};

/** Sends `items` in batches of at most `batchSize`; summaries add up and results keep request order. */
async function writeInBatches<Item, Result>(
  items: readonly Item[],
  batchSize: number,
  write: (batch: Item[]) => Promise<BatchWriteResponse<Result>>
): Promise<BatchWriteResponse<Result>> {
  const responses = await processBatches(
    items,
    async (batch) => [await write(batch)],
    { batchSize }
  );
  const total = (key: keyof BatchWriteSummary) =>
    responses.reduce((sum, response) => sum + response.summary[key], 0);
  return {
    summary: {
      total: total('total'),
      succeeded: total('succeeded'),
      failed: total('failed'),
    },
    results: responses.flatMap((response) => response.results),
  };
}

// The server checks this per request; a list split into batches must hold it
// as a whole, or a later batch could move onto a file an earlier one created.
function assertDisjointMoves(
  moves: readonly MoveFilesData['body']['moves'][number][]
): void {
  const oldFileIds = new Set(moves.map(({ oldFileId }) => oldFileId));
  const newFileIds = new Set(moves.map(({ newFileId }) => newFileId));
  if (
    oldFileIds.size === moves.length &&
    newFileIds.size === moves.length &&
    !Array.from(oldFileIds).some((fileId) => newFileIds.has(fileId))
  ) {
    return;
  }
  throw new Error(
    createDiagnosticMessage({
      source: 'generaltranslation',
      severity: 'Error',
      whatHappened:
        'Each old and each new file ID may appear once in a move list, and no file ID may be both an old and a new file ID',
      fix: 'Move through an unused file ID in separate `moveFiles()` calls',
    })
  );
}

// Publishing and unpublishing one version in separate concurrent batches
// would leave its CDN state to whichever request finishes last.
function assertUniquePublishVersions(
  files: readonly PublishFilesData['body']['files'][number][]
): void {
  const versions = new Set(
    files.map(({ branchId, fileId, versionId }) =>
      JSON.stringify([branchId, fileId, versionId])
    )
  );
  if (versions.size === files.length) return;
  throw new Error(
    createDiagnosticMessage({
      source: 'generaltranslation',
      severity: 'Error',
      whatHappened:
        'Each branch, file, and version may appear once in a publish list',
      fix: 'Send each file version once, with the `publish` value it should end with',
    })
  );
}

export type GtApiAdapterConfig = ApiClientConfig & {
  customMapping?: CustomMapping;
  /** Project for project-scoped operations (`path.projectId`). */
  projectId?: string;
  /** Organization for org-scoped operations (fonts); read from the project when omitted. */
  orgId?: string;
};

export function createGtApiAdapter(defaultConfig?: GtApiAdapterConfig) {
  let client: ReturnType<typeof createApiClient> | undefined;
  let config: GtApiAdapterConfig | undefined;
  let cachedOrgId: string | undefined;

  // Mapping resolves aliases; standardization also canonicalizes configured
  // spellings such as en-us before they cross the service boundary.
  function resolveServiceLocale(locale: string): string {
    return standardizeLocale(
      resolveCanonicalLocale(locale, config?.customMapping)
    );
  }

  // Responses echo the canonical locale; callers key lockfile entries by the
  // configured alias, so map it back before it leaves the adapter.
  function aliasLocale<T extends { locale?: string }>(item: T): T {
    return item.locale
      ? {
          ...item,
          locale: resolveAliasLocale(item.locale, config?.customMapping),
        }
      : item;
  }

  function aliasJobSubject<
    T extends { id: string; subject?: { type: string; locale?: string } },
  >(job: T): T {
    return job.subject ? { ...job, subject: aliasLocale(job.subject) } : job;
  }

  function toFileSelector({
    fileId,
    branchId,
    versionId,
    locale,
  }: QueryFilesData['body']['files'][number]) {
    return {
      fileId,
      branchId,
      versionId,
      locale: locale && resolveServiceLocale(locale),
    };
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
    cachedOrgId = undefined;
  }

  function getProjectId(): string {
    const { projectId } = getConfig();
    if (!projectId) {
      throw new Error(
        createDiagnosticMessage({
          source: 'generaltranslation',
          severity: 'Error',
          whatHappened: 'No project ID is configured for the API client',
          fix: 'Set `projectId` in the API client configuration',
        })
      );
    }
    return projectId;
  }

  // Canonical operations type-require gt-api-version per call, and per-call
  // headers override the client's, so send the configured version.
  function apiVersionHeaders() {
    return { 'gt-api-version': getConfig().apiVersion ?? API_VERSION };
  }

  function projectRequest(timeoutMs?: number) {
    return {
      client: getClient(timeoutMs),
      headers: apiVersionHeaders(),
      path: { projectId: getProjectId() },
    };
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

  function aliasProject<T extends GetProjectResponse>(project: T): T {
    return {
      ...project,
      defaultLocale: resolveAliasLocale(
        project.defaultLocale,
        config?.customMapping
      ),
      currentLocales: project.currentLocales.map((locale) =>
        resolveAliasLocale(locale, config?.customMapping)
      ),
    };
  }

  async function createBranchOperation(
    query: CreateBranchData['body']
  ): Promise<CreateBranchResponse> {
    const body = { name: query.name, isDefault: query.isDefault };
    try {
      return unwrapApiResult(await createBranch({ ...projectRequest(), body }));
    } catch (error) {
      // 409 also covers a second default branch; only a name match is recoverable.
      if (!(error instanceof ApiError && error.code === 409)) throw error;
      // A key without branch read access (403) can't look the branch up.
      const query: ListBranchesData['query'] = { name: [body.name] };
      const [branch] = await collect(
        paginate(listBranches, { ...projectRequest(), query })
      ).catch((listError: unknown) => {
        if (listError instanceof ApiError && listError.code === 403) return [];
        throw listError;
      });
      if (!branch) throw error;
      return { branch };
    }
  }

  async function moveFilesOperation(
    moves: MoveFilesData['body']['moves'],
    options: { branchId?: string; timeout?: number } = {}
  ) {
    assertDisjointMoves(moves);
    return writeInBatches(moves, MOVE_FILES_BATCH_SIZE, async (batch) =>
      unwrapApiResult(
        await moveFiles({
          ...projectRequest(options.timeout),
          body: { branchId: options.branchId, moves: batch },
        })
      )
    );
  }

  async function generateProjectContextOperation(
    files: GenerateProjectContextData['body']['files'],
    options: Omit<GenerateProjectContextData['body'], 'files'> & {
      timeout?: number;
    } = {}
  ) {
    return unwrapApiResult(
      await generateProjectContext({
        ...projectRequest(options.timeout),
        body: {
          files: files.map(({ branchId, fileId, versionId }) => ({
            branchId,
            fileId,
            versionId,
          })),
          locales: options.locales?.map(resolveServiceLocale),
          force: options.force,
        },
      })
    );
  }

  async function translateFilesOperation(
    files: TranslateFilesData['body']['files'],
    options: Omit<TranslateFilesData['body'], 'files' | 'modelProvider'> & {
      modelProvider?: string;
      timeout?: number;
    } = {}
  ) {
    const { modelProvider } = options;
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
    const jobs = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await translateFiles({
          ...projectRequest(options.timeout),
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
            targetLocales: options.targetLocales?.map(resolveServiceLocale),
            sourceLocale: options.sourceLocale
              ? resolveServiceLocale(options.sourceLocale)
              : undefined,
            modelProvider,
            force: options.force,
            publish: options.publish,
          },
        })
      );
      return response.jobs.map(aliasJobSubject);
    });
    return { jobs };
  }

  async function overwriteTranslationsOperation(
    diffs: OverwriteTranslationsData['body']['diffs'],
    options: { timeout?: number } = {}
  ) {
    const response = await writeInBatches(
      diffs,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await overwriteTranslations({
            ...projectRequest(options.timeout),
            body: {
              diffs: batch.map(
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
          })
        )
    );
    return { ...response, results: response.results.map(aliasLocale) };
  }

  async function queryFilesOperation(
    files: QueryFilesData['body']['files'],
    options: { timeout?: number } = {}
  ) {
    const results = await queryEachSelector(files, (distinct) =>
      processBatches(distinct, async (batch) => {
        const response = unwrapApiResult(
          await queryFiles({
            ...projectRequest(options.timeout),
            body: { files: batch.map(toFileSelector) },
          })
        );
        return response.results;
      })
    );
    return {
      results: results.map((result) => ({
        ...result,
        ...(result.sourceLocale && {
          sourceLocale: resolveAliasLocale(
            result.sourceLocale,
            config?.customMapping
          ),
        }),
        ...(result.locales && {
          locales: result.locales.map((locale) =>
            resolveAliasLocale(locale, config?.customMapping)
          ),
        }),
      })),
    };
  }

  // Distinct requested locales can resolve to the same service locale, and the
  // API rejects exact repeats: send each distinct wire selector once and give
  // every request its result, in request order, under the locale it requested.
  async function queryEachSelector<
    Selector extends QueryFilesData['body']['files'][number],
    Result extends { locale?: string },
  >(
    files: readonly Selector[],
    query: (distinct: Selector[]) => Promise<Result[]>
  ): Promise<Result[]> {
    const positionByKey = new Map<string, number>();
    const distinct: Selector[] = [];
    const positions = files.map((file) => {
      const key = JSON.stringify([
        file.fileId,
        file.branchId,
        file.versionId,
        file.locale && resolveServiceLocale(file.locale),
      ]);
      let position = positionByKey.get(key);
      if (position === undefined) {
        position = distinct.push(file) - 1;
        positionByKey.set(key, position);
      }
      return position;
    });
    const results = await query(distinct);
    return positions.map((position, index) => {
      const result = results[position];
      const { locale } = files[index];
      return result.locale && locale
        ? { ...result, locale }
        : aliasLocale(result);
    });
  }

  async function getFileStatusOperation(
    fileId: string,
    query: GetFileStatusData['query'] = {},
    options: { timeout?: number } = {}
  ) {
    const request = projectRequest(options.timeout);
    const result = unwrapApiResult(
      await getFileStatus({
        ...request,
        path: { ...request.path, fileId },
        query,
      })
    );
    return {
      ...result,
      translations: result.translations.map(aliasLocale),
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
  }

  async function queryFilesContentOperation(
    files: QueryFilesContentData['body']['files'],
    options: { timeout?: number } = {}
  ) {
    const results = await queryEachSelector(files, (distinct) =>
      processBatches(distinct, async (batch) => {
        const response = unwrapApiResult(
          await queryFilesContent({
            ...projectRequest(options.timeout),
            body: { files: batch.map(toFileSelector) },
          })
        );
        return response.results;
      })
    );
    return {
      results: results.map((result) => ({
        ...result,
        ...(typeof result.data === 'string' && {
          data: decodeFileContent(result.data, result.fileFormat),
        }),
      })),
    };
  }

  async function getFileContentOperation(
    fileId: string,
    query: GetFileContentData['query'] = {},
    options: { timeout?: number } = {}
  ) {
    const request = projectRequest(options.timeout);
    const result = unwrapApiResult(
      await getFileContent({
        ...request,
        path: { ...request.path, fileId },
        query: {
          ...query,
          locale: query.locale && resolveServiceLocale(query.locale),
        },
      })
    );
    return {
      ...aliasLocale(result),
      data:
        result.data === null
          ? null
          : decodeFileContent(result.data, result.fileFormat),
    };
  }

  async function uploadSourceFilesOperation(
    files: Array<{
      source: UploadSourceFilesData['body']['data'][number]['source'];
    }>,
    options: { sourceLocale: string; timeout?: number }
  ) {
    const sourceLocale = resolveServiceLocale(options.sourceLocale);
    const response = await writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await uploadSourceFiles({
            ...projectRequest(options.timeout),
            body: {
              data: batch.map(({ source }) => ({
                source: {
                  ...source,
                  content: encodeFileContent(source.content, source.fileFormat),
                  locale: resolveServiceLocale(source.locale),
                },
              })),
              sourceLocale,
            },
          })
        )
    );
    return response;
  }

  async function uploadTranslationsOperation(
    files: UploadTranslationsData['body']['data'],
    options: { timeout?: number } = {}
  ) {
    validateFileFormatTransforms(files.map(({ source }) => source));
    const response = await writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await uploadTranslations({
            ...projectRequest(options.timeout),
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
            },
          })
        )
    );
    return { ...response, results: response.results.map(aliasLocale) };
  }

  async function upsertAssetsOperation(
    assets: UpsertAssetsData['body']['assets'],
    options: { timeout?: number } = {}
  ) {
    // No fonts: no request, not even the org lookup.
    if (assets.length === 0) {
      return { summary: { total: 0, succeeded: 0, failed: 0 }, results: [] };
    }
    // One configuration per call: configure() during the org lookup must not
    // redirect this upload or let the old org into the new config's cache.
    const requestConfig = getConfig();
    const client = getClient(options.timeout);
    const headers = apiVersionHeaders();
    const orgId =
      requestConfig.orgId ??
      cachedOrgId ??
      unwrapApiResult(
        await getProject({
          client,
          headers,
          path: { projectId: getProjectId() },
        })
      ).orgId;
    if (config === requestConfig) cachedOrgId = orgId;
    return writeInBatches(assets, UPSERT_ASSETS_BATCH_SIZE, async (batch) =>
      unwrapApiResult(
        await upsertAssets({
          client,
          headers,
          path: { orgId },
          body: { assets: batch },
        })
      )
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

    async getProject(options: { timeout?: number } = {}) {
      const projectId = getConfig().projectId;
      if (!projectId) {
        throw new Error('Project ID is required to fetch project information');
      }
      return aliasProject(
        unwrapApiResult(
          await getProject({
            client: getClient(options.timeout),
            headers: apiVersionHeaders(),
            path: { projectId },
          })
        )
      );
    },

    async updateProject(
      body: UpdateProjectData['body'],
      options: { timeout?: number } = {}
    ) {
      const project = unwrapApiResult(
        await updateProject({
          ...projectRequest(options.timeout),
          body: {
            ...body,
            defaultLocale:
              body.defaultLocale && resolveServiceLocale(body.defaultLocale),
          },
        })
      );
      return aliasProject(project);
    },

    /** One page of branches. */
    async listBranches(
      query: ListBranchesData['query'] = {},
      options: { timeout?: number } = {}
    ) {
      return unwrapApiResult(
        await listBranches({ ...projectRequest(options.timeout), query })
      );
    },

    /** Creates the branch; one that already exists by name is returned instead of a 409. */
    createBranch: createBranchOperation,

    /** Renames a branch or makes it the default. Omitted fields stay unchanged. */
    async updateBranch(
      branchId: string,
      body: UpdateBranchData['body'],
      options: { timeout?: number } = {}
    ) {
      const request = projectRequest(options.timeout);
      return unwrapApiResult(
        await updateBranch({
          ...request,
          path: { ...request.path, branchId },
          body,
        })
      );
    },

    /** Rejects a move list whose file IDs overlap before sending any request. */
    moveFiles: moveFilesOperation,

    /** One page of the branch's files. */
    async listBranchFiles(
      branchId: string,
      query: ListBranchFilesData['query'] = {},
      options: { timeout?: number } = {}
    ) {
      const request = projectRequest(options.timeout);
      return unwrapApiResult(
        await listBranchFiles({
          ...request,
          path: { ...request.path, branchId },
          query,
        })
      );
    },

    generateProjectContext: generateProjectContextOperation,

    async queryJobs(
      jobIds: readonly string[],
      options: { signal?: AbortSignal; timeout?: number } = {}
    ) {
      const results = await queryJobsInBatches(
        getClient(options.timeout),
        getProjectId(),
        jobIds,
        options.signal
      );
      return { results: results.map(aliasJobSubject) };
    },

    async awaitJobs(jobIds: readonly string[], options: AwaitJobsOptions = {}) {
      const { onPoll } = options;
      const result = await awaitJobs(getClient(), getProjectId(), jobIds, {
        ...options,
        onPoll: onPoll && ((statuses) => onPoll(statuses.map(aliasJobSubject))),
      });
      return { ...result, jobs: result.jobs.map(aliasJobSubject) };
    },

    async getJob(jobId: string, options: { timeout?: number } = {}) {
      const request = projectRequest(options.timeout);
      return aliasJobSubject(
        unwrapApiResult(
          await getJob({ ...request, path: { ...request.path, jobId } })
        )
      );
    },

    translateFiles: translateFilesOperation,

    async setTag(tagId: string, body: SetTagData['body']) {
      const request = projectRequest();
      return unwrapApiResult(
        await setTag({ ...request, path: { ...request.path, tagId }, body })
      );
    },

    /** Batched at the server cap; rejects a repeated file version before sending any request. Never throws on per-item failures. */
    async publishFiles(files: PublishFilesData['body']['files']) {
      assertUniquePublishVersions(files);
      const response = await writeInBatches(
        files,
        DEFAULT_BATCH_SIZE,
        async (batch) =>
          unwrapApiResult(
            await publishFiles({
              ...projectRequest(),
              // Map only the contract fields so caller extras never reach the wire.
              body: {
                files: batch.map(
                  ({ fileId, versionId, branchId, publish }) => ({
                    fileId,
                    versionId,
                    branchId,
                    publish,
                  })
                ),
              },
            })
          )
      );
      return {
        ...response,
        results: response.results.map((result) => ({
          ...result,
          translations: result.translations.map(aliasLocale),
        })),
      };
    },

    overwriteTranslations: overwriteTranslationsOperation,
    queryFiles: queryFilesOperation,
    getFileStatus: getFileStatusOperation,
    getFileContent: getFileContentOperation,
    queryFilesContent: queryFilesContentOperation,
    /** Never throws on per-item failures. */
    uploadSourceFiles: uploadSourceFilesOperation,
    /** Never throws on per-item failures. */
    uploadTranslations: uploadTranslationsOperation,
    upsertAssets: upsertAssetsOperation,

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
  };
}

export type GtApiAdapter = ReturnType<typeof createGtApiAdapter>;
