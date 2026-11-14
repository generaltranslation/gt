import {
  awaitJobs,
  createBranch,
  createProjectApiKey,
  DEFAULT_BATCH_SIZE,
  deleteProjectApiKey,
  fetchFileDownload,
  generateProjectContext,
  getFileContent,
  getFileStatus,
  getJob,
  getProject,
  getProjectApiKey,
  listBranchFiles,
  listBranches,
  listProjectApiKeys,
  moveFiles,
  overwriteTranslations,
  processBatches,
  publishFiles,
  queryFiles,
  queryFilesContent,
  queryJobsInBatches,
  setTag,
  translateFiles,
  updateBranch,
  updateFiles,
  updateProject,
  uploadSourceFiles,
  uploadTranslations,
  type AwaitJobsOptions,
  type AwaitJobsResult,
  type CreateBranchData,
  type CreateBranchResponse,
  type CreateProjectApiKeyData,
  type CreateProjectApiKeyResponse,
  type DeleteProjectApiKeyResponse,
  type GenerateProjectContextData,
  type GenerateProjectContextResponse,
  type GetFileContentData,
  type GetFileContentResponse,
  type GetFileStatusData,
  type GetFileStatusResponse,
  type GetJobResponse,
  type GetProjectApiKeyResponse,
  type GetProjectResponse,
  type ListBranchesData,
  type ListBranchesResponse,
  type ListBranchFilesData,
  type ListBranchFilesResponse,
  type ListProjectApiKeysData,
  type ListProjectApiKeysResponse,
  type MoveFilesResponse,
  type OverwriteTranslationsData,
  type OverwriteTranslationsResponse,
  type PublishFilesResponse,
  type QueryFilesContentData,
  type QueryFilesContentResponse,
  type QueryFilesData,
  type QueryFilesResponse,
  type QueryJobsResponse,
  type SetTagData,
  type SetTagResponse,
  type TranslateFilesData,
  type TranslateFilesResponse,
  type UpdateBranchData,
  type UpdateBranchResponse,
  type UpdateFilesData,
  type UpdateFilesResponse,
  type UpdateProjectData,
  type UpdateProjectResponse,
  type UploadSourceFilesResponse,
  type UploadTranslationsResponse,
} from '@generaltranslation/api';
import {
  resolveAliasLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import {
  apiVersionHeaders,
  createGtApiClient,
  resolveServiceLocale,
  writeInBatches,
} from './apiClient';
import { createDiagnosticMessage } from '../logging/diagnostics';
import type { GTProjectConfig } from './clientConfig';
import { GTRuntime } from '../runtime';
import { validateModelProvider } from '../translate/modelProvider';
import type { MoveMapping } from '../translate/moveFiles';
import type { PublishFileEntry } from '../translate/publishFiles';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';
import { uploadFileContents } from '../translate/uploadFileContents';
import type {
  FileUpload,
  TranslationUpload,
} from '../types-dir/api/uploadFiles';
import { decodeFileContent } from '../utils/base64';

// The server accepts at most 25 moves per request.
const MOVE_FILES_BATCH_SIZE = 25;

/**
 * Project and file operations, plus runtime translation, for one project: the
 * project-scoped `new GeneralTranslation({ projectId })` and `account.project(projectId)`.
 */
export class ProjectHandle extends GTRuntime {
  private readonly params: Readonly<GTProjectConfig>;
  private readonly client: ReturnType<typeof createGtApiClient>;

  /** @throws {Error} If `projectId` is not a non-empty string. */
  constructor(params: GTProjectConfig) {
    super(params);
    this.params = { ...params, localeConfig: this.localeConfig };
    this.client = createGtApiClient(this.params);
    Object.freeze(this);
  }

  private request(timeoutMs?: number) {
    return {
      client:
        timeoutMs === undefined
          ? this.client
          : createGtApiClient(this.params, timeoutMs),
      headers: apiVersionHeaders(),
      path: { projectId: this.projectId },
    };
  }

  /** Convert app identity only where a GT service expects a language code. */
  private resolveServiceLocale(locale: string): string {
    return resolveServiceLocale(locale, this.localeConfig.customMapping);
  }

  /**
   * Responses echo the service locale: recover the first configured identity
   * with the same service code, without negotiating an unrelated dialect, and
   * otherwise its `customMapping` alias. When several identities use the same
   * service code, one the caller `requested` wins, then the first configured.
   */
  private restoreLocale(
    locale: string,
    requested: readonly string[] = []
  ): string {
    const { locales, defaultLocale, customMapping } = this.localeConfig;
    const aliased = resolveAliasLocale(locale, customMapping);
    const canonical = standardizeLocale(locale);
    const configured = [
      ...requested,
      ...(locales ?? []),
      defaultLocale,
      ...Object.keys(customMapping ?? {}),
    ];
    return (
      configured.find(
        (candidate) =>
          candidate && this.resolveServiceLocale(candidate) === canonical
      ) ?? aliased
    );
  }

  private aliasLocale<T extends { locale?: string }>(
    item: T,
    requested?: readonly string[]
  ): T {
    return item.locale
      ? { ...item, locale: this.restoreLocale(item.locale, requested) }
      : item;
  }

  private aliasJobSubject<
    T extends { id: string; subject?: { type: string; locale?: string } },
  >(job: T, requested?: readonly string[]): T {
    return job.subject
      ? { ...job, subject: this.aliasLocale(job.subject, requested) }
      : job;
  }

  private restoreProjectLocales<
    T extends { defaultLocale: string; currentLocales: string[] },
  >(project: T): T {
    return {
      ...project,
      defaultLocale: this.restoreLocale(project.defaultLocale),
      currentLocales: project.currentLocales.map((locale) =>
        this.restoreLocale(locale)
      ),
    };
  }

  private toFileSelector({
    fileId,
    branchId,
    versionId,
    locale,
  }: QueryFilesData['body']['files'][number]) {
    return {
      fileId,
      branchId,
      versionId,
      locale: locale && this.resolveServiceLocale(locale),
    };
  }

  // Distinct requested locales can resolve to the same service locale, and the
  // API rejects exact repeats: send each distinct wire selector once and give
  // every request its result, in request order, under the locale it requested.
  private async queryEachSelector<
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
        file.locale && this.resolveServiceLocale(file.locale),
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
        : this.aliasLocale(result);
    });
  }

  // -------------- Project Methods -------------- //

  /**
   * Fetches the project: name, organization, locales, review and CDN settings.
   */
  async get(options: { timeout?: number } = {}): Promise<GetProjectResponse> {
    return this.restoreProjectLocales(
      unwrapApiResult(await getProject(this.request(options.timeout)))
    );
  }

  /**
   * Updates the project's settings. Omitted settings stay unchanged.
   *
   * @param body - The settings to change.
   */
  async update(
    body: UpdateProjectData['body'],
    options: { timeout?: number } = {}
  ): Promise<UpdateProjectResponse> {
    return this.restoreProjectLocales(
      unwrapApiResult(
        await updateProject({
          ...this.request(options.timeout),
          body: {
            ...body,
            defaultLocale:
              body.defaultLocale &&
              this.resolveServiceLocale(body.defaultLocale),
          },
        })
      )
    );
  }

  /**
   * Creates an API key for the project with exactly the requested
   * permissions. The returned `key` is shown only once.
   *
   * @param body - The key `name` and `permissions`.
   */
  async createApiKey(
    body: CreateProjectApiKeyData['body']
  ): Promise<CreateProjectApiKeyResponse> {
    return unwrapApiResult(
      await createProjectApiKey({
        path: { projectId: this.projectId },
        body,
        client: this.client,
      })
    );
  }

  /**
   * Lists one page of the project's API keys. A key's secret is returned only
   * when it is created.
   *
   * @param query - Paging (`cursor`, `limit`).
   */
  async listApiKeys(
    query: ListProjectApiKeysData['query'] = {},
    options: { timeout?: number } = {}
  ): Promise<ListProjectApiKeysResponse> {
    return unwrapApiResult(
      await listProjectApiKeys({ ...this.request(options.timeout), query })
    );
  }

  /**
   * Gets a project API key, without its secret.
   *
   * @param apiKeyId - The key to read.
   */
  async getApiKey(
    apiKeyId: string,
    options: { timeout?: number } = {}
  ): Promise<GetProjectApiKeyResponse> {
    const request = this.request(options.timeout);
    return unwrapApiResult(
      await getProjectApiKey({
        ...request,
        path: { ...request.path, apiKeyId },
      })
    );
  }

  /**
   * Deletes a project API key. The key usually stops working at once, and
   * always within 10 minutes. A key that does not exist throws an `ApiError`
   * with code `not_found`.
   *
   * @param apiKeyId - The key to delete.
   */
  async deleteApiKey(
    apiKeyId: string,
    options: { timeout?: number } = {}
  ): Promise<DeleteProjectApiKeyResponse> {
    const request = this.request(options.timeout);
    return unwrapApiResult(
      await deleteProjectApiKey({
        ...request,
        path: { ...request.path, apiKeyId },
      })
    );
  }

  // -------------- Branch Methods -------------- //

  /**
   * Lists one page of the project's branches.
   *
   * @param query - Filters (`name`, `isDefault`) and paging (`cursor`, `limit`).
   */
  async listBranches(
    query: ListBranchesData['query'] = {},
    options: { timeout?: number } = {}
  ): Promise<ListBranchesResponse> {
    return unwrapApiResult(
      await listBranches({ ...this.request(options.timeout), query })
    );
  }

  /**
   * Creates a branch. A name the project already has throws an `ApiError` with code `already_exists`;
   * to reuse an existing branch, look it up with `listBranches({ name: [name] })` first.
   *
   * @param query - The branch `name` and whether it `isDefault`.
   * @returns The created branch.
   */
  async createBranch(
    query: CreateBranchData['body']
  ): Promise<CreateBranchResponse> {
    return unwrapApiResult(
      await createBranch({
        ...this.request(),
        body: { name: query.name, isDefault: query.isDefault },
      })
    );
  }

  /**
   * Renames a branch or makes it the project's default branch. Omitted
   * fields stay unchanged.
   *
   * @param branchId - The branch to update.
   * @param body - The new `name` and/or `isDefault: true`.
   */
  async updateBranch(
    branchId: string,
    body: UpdateBranchData['body'],
    options: { timeout?: number } = {}
  ): Promise<UpdateBranchResponse> {
    const request = this.request(options.timeout);
    return unwrapApiResult(
      await updateBranch({
        ...request,
        path: { ...request.path, branchId },
        body,
      })
    );
  }

  /**
   * Lists one page of the files on a branch, with their head versions.
   *
   * @param branchId - The branch to list.
   * @param query - Paging (`cursor`, `limit`).
   */
  async listBranchFiles(
    branchId: string,
    query: ListBranchFilesData['query'] = {},
    options: { timeout?: number } = {}
  ): Promise<ListBranchFilesResponse> {
    const request = this.request(options.timeout);
    return unwrapApiResult(
      await listBranchFiles({
        ...request,
        path: { ...request.path, branchId },
        query,
      })
    );
  }

  /**
   * Moves files to new file IDs, cloning each source file and its translations,
   * in batches the server accepts. A move can fail on its own; check
   * `summary.failed` and each result's `status`.
   *
   * @param {MoveMapping[]} moves - Old file ID to new file ID and name.
   * @param options - Branch and timeout.
   * @returns The summary and one result per move, in request order.
   */
  async moveFiles(
    moves: MoveMapping[],
    options: { branchId?: string; timeout?: number } = {}
  ): Promise<MoveFilesResponse> {
    // The server checks this per request; a list split into batches must hold it
    // as a whole, or a later batch could move onto a file an earlier one created.
    const oldFileIds = new Set(moves.map(({ oldFileId }) => oldFileId));
    const newFileIds = new Set(moves.map(({ newFileId }) => newFileId));
    if (
      oldFileIds.size !== moves.length ||
      newFileIds.size !== moves.length ||
      Array.from(oldFileIds).some((fileId) => newFileIds.has(fileId))
    ) {
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
    return writeInBatches(
      moves,
      MOVE_FILES_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await moveFiles({
            ...this.request(options.timeout),
            body: { branchId: options.branchId, moves: batch },
          })
        ),
      ({ oldFileId, newFileId }, failure) => [
        { oldFileId, newFileId, status: 'failed' as const, ...failure },
      ]
    );
  }

  // -------------- Job Methods -------------- //

  /**
   * Queues context generation for the project from previously uploaded source files.
   *
   * @param files - Source file versions to generate the context from.
   * @param options - Target `locales`, `force`, and timeout.
   * @returns The queued job, or `job: null` when the context is already current.
   */
  async generateProjectContext(
    files: GenerateProjectContextData['body']['files'],
    options: Omit<GenerateProjectContextData['body'], 'files'> & {
      timeout?: number;
    } = {}
  ): Promise<GenerateProjectContextResponse> {
    return unwrapApiResult(
      await generateProjectContext({
        ...this.request(options.timeout),
        body: {
          files: files.map(({ branchId, fileId, versionId }) => ({
            branchId,
            fileId,
            versionId,
          })),
          locales: options.locales?.map((locale) =>
            this.resolveServiceLocale(locale)
          ),
          force: options.force,
        },
      })
    );
  }

  /**
   * Reads the statuses of project jobs, in batches the server accepts.
   * A job the project does not have is `not_found`.
   *
   * @param jobIds - The jobs to read; each ID may appear once.
   * @param options - Timeout, and a `signal` that aborts in-flight requests.
   * @returns One result per job ID, in request order.
   */
  async queryJobs(
    jobIds: string[],
    options: { signal?: AbortSignal; timeout?: number } = {}
  ): Promise<QueryJobsResponse> {
    const results = await queryJobsInBatches(
      this.request(options.timeout).client,
      this.projectId,
      jobIds,
      options.signal
    );
    return { results: results.map((job) => this.aliasJobSubject(job)) };
  }

  /**
   * Reads one project job.
   *
   * @param jobId - The job to read.
   */
  async getJob(
    jobId: string,
    options: { timeout?: number } = {}
  ): Promise<GetJobResponse> {
    const request = this.request(options.timeout);
    return this.aliasJobSubject(
      unwrapApiResult(
        await getJob({ ...request, path: { ...request.path, jobId } })
      )
    );
  }

  /**
   * Polls job statuses until all jobs are finished or the timeout is reached.
   * A job the project does not have is `not_found`; one not polled before the
   * timeout is `unknown`.
   *
   * @param jobIds - The jobs to poll.
   * @param options - Polling interval, timeout, and an `onPoll` callback.
   * @returns The final status of all jobs and whether they all completed.
   */
  async awaitJobs(
    jobIds: string[],
    options: AwaitJobsOptions = {}
  ): Promise<AwaitJobsResult> {
    const { onPoll } = options;
    const result = await awaitJobs(this.client, this.projectId, jobIds, {
      ...options,
      onPoll:
        onPoll &&
        ((statuses) =>
          onPoll(statuses.map((job) => this.aliasJobSubject(job)))),
    });
    return {
      ...result,
      jobs: result.jobs.map((job) => this.aliasJobSubject(job)),
    };
  }

  // -------------- Translation Methods -------------- //

  /**
   * Queues translation jobs for previously uploaded source files, in batches
   * the server accepts. Poll the returned jobs with `awaitJobs()` or `queryJobs()`.
   *
   * @param files - Source file versions to translate.
   * @param options - Target and source locales, `force`, `modelProvider`, `publish`, and timeout.
   * @returns One job per file and target locale that needs translating; empty when nothing is queued.
   */
  async translateFiles(
    files: TranslateFilesData['body']['files'],
    options: Omit<TranslateFilesData['body'], 'files'> & {
      timeout?: number;
    } = {}
  ): Promise<TranslateFilesResponse> {
    const { modelProvider } = options;
    validateModelProvider(modelProvider);
    const jobs = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await translateFiles({
          ...this.request(options.timeout),
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
            targetLocales: options.targetLocales?.map((locale) =>
              this.resolveServiceLocale(locale)
            ),
            sourceLocale: options.sourceLocale
              ? this.resolveServiceLocale(options.sourceLocale)
              : undefined,
            modelProvider,
            force: options.force,
            publish: options.publish,
          },
        })
      );
      return response.jobs.map((job) =>
        this.aliasJobSubject(job, options.targetLocales)
      );
    });
    return { jobs };
  }

  /**
   * Creates or replaces a tag: points `tagId` at exactly the given source file
   * versions and sets its message (omitted clears it).
   *
   * @param tagId - The tag name, unique within the project.
   * @param body - The tagged file versions and optional message.
   * @returns The tag.
   */
  async setTag(
    tagId: string,
    body: SetTagData['body']
  ): Promise<SetTagResponse> {
    const request = this.request();
    return unwrapApiResult(
      await setTag({ ...request, path: { ...request.path, tagId }, body })
    );
  }

  /**
   * Publishes or unpublishes file versions on the CDN, in batches the server
   * accepts. A version can fail on its own; check `summary.failed` and each
   * result's `status` and `translations`.
   *
   * @param {PublishFileEntry[]} files - File versions with publish flags; each branch, file, and version may appear once.
   * @returns {Promise<PublishFilesResponse>} The summary and one result per file version, in request order.
   */
  async publishFiles(files: PublishFileEntry[]): Promise<PublishFilesResponse> {
    // Publishing and unpublishing one version in separate concurrent batches
    // would leave its CDN state to whichever request finishes last.
    const versions = new Set(
      files.map(({ branchId, fileId, versionId }) =>
        JSON.stringify([branchId, fileId, versionId])
      )
    );
    if (versions.size !== files.length) {
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
    const response = await writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await publishFiles({
            ...this.request(),
            // Map only the contract fields so caller extras never reach the wire.
            body: {
              files: batch.map(({ fileId, versionId, branchId, publish }) => ({
                fileId,
                versionId,
                branchId,
                publish,
              })),
            },
          })
        ),
      ({ fileId, versionId, branchId }, failure) => [
        {
          fileId,
          versionId,
          branchId: branchId ?? '',
          status: 'failed' as const,
          ...failure,
          translations: [],
        },
      ]
    );
    return {
      ...response,
      results: response.results.map((item) => ({
        ...item,
        translations: item.translations.map((translation) => ({
          ...translation,
          locale: this.restoreLocale(translation.locale),
        })),
      })),
    };
  }

  /**
   * Replaces translations with full local content so future generations
   * preserve user edits, in batches the server accepts. A translation can fail
   * on its own; check `summary.failed` and each result's `status`.
   *
   * @param diffs - One entry per translation with its diff and full local content.
   * @returns The summary and one result per translation, in request order.
   */
  async overwriteTranslations(
    diffs: OverwriteTranslationsData['body']['diffs'],
    options: { timeout?: number } = {}
  ): Promise<OverwriteTranslationsResponse> {
    const response = await writeInBatches(
      diffs,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await overwriteTranslations({
            ...this.request(options.timeout),
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
                  locale: this.resolveServiceLocale(locale),
                })
              ),
            },
          })
        ),
      ({ branchId = '', versionId, fileId, locale }, failure) => [
        {
          branchId,
          versionId,
          fileId,
          locale,
          status: 'failed' as const,
          ...failure,
        },
      ]
    );
    return {
      ...response,
      results: response.results.map((item, index) => ({
        ...item,
        locale: diffs[index].locale,
      })),
    };
  }

  // -------------- File Methods -------------- //

  /**
   * Reads metadata of source files and translations, in batches the server
   * accepts. A selector without `locale` reads the source file.
   *
   * @param files - Selectors sharing a file ID, branch ID, version ID, and resolved locale share one request result.
   * @returns One result per selector, in selector order: `found`, `pending`, or `not_found`.
   */
  async queryFiles(
    files: QueryFilesData['body']['files'],
    options: { timeout?: number } = {}
  ): Promise<QueryFilesResponse> {
    const results = await this.queryEachSelector(files, (distinct) =>
      processBatches(distinct, async (batch) => {
        const response = unwrapApiResult(
          await queryFiles({
            ...this.request(options.timeout),
            body: { files: batch.map((file) => this.toFileSelector(file)) },
          })
        );
        return response.results;
      })
    );
    return {
      results: results.map((result) => ({
        ...result,
        ...(result.sourceLocale && {
          sourceLocale: this.restoreLocale(result.sourceLocale),
        }),
        ...(result.locales && {
          locales: result.locales.map((locale) => this.restoreLocale(locale)),
        }),
      })),
    };
  }

  /**
   * Reads a source file's status and the status of each of its translations.
   *
   * @param fileId - The source file.
   * @param query - Branch and source version; default to the default branch and its head.
   * @returns The source file and its translations.
   */
  async getFileStatus(
    fileId: string,
    query: GetFileStatusData['query'] = {},
    options: { timeout?: number } = {}
  ): Promise<GetFileStatusResponse> {
    const request = this.request(options.timeout);
    const result = unwrapApiResult(
      await getFileStatus({
        ...request,
        path: { ...request.path, fileId },
        query,
      })
    );
    return {
      translations: result.translations.map((item) => ({
        ...item,
        ...(item.locale && { locale: this.restoreLocale(item.locale) }),
      })),
      sourceFile: {
        ...result.sourceFile,
        ...(result.sourceFile.sourceLocale && {
          sourceLocale: this.restoreLocale(result.sourceFile.sourceLocale),
        }),
        locales: result.sourceFile.locales.map((locale) =>
          this.restoreLocale(locale)
        ),
      },
    };
  }

  /**
   * Reads the decoded content of a source file, or with `locale` of one translation.
   * Without `versionId`, a translation is the newest completed version on the branch.
   *
   * @param fileId - The source file.
   * @param query - Branch, source version, and translation locale.
   * @returns The content, or `status: 'pending'` with `data: null` when the translation is stored but not
   * completed yet (for example during a layout pass). Until its translation job stores the translation
   * the read is a 404, so wait for the job with `awaitJobs` or `getJob` first. A ready media file over
   * 20MB also has `data: null`, with a `downloadUrl` to pass to `fetchFileDownload()`.
   */
  async getFileContent(
    fileId: string,
    query: GetFileContentData['query'] = {},
    options: { timeout?: number } = {}
  ): Promise<GetFileContentResponse> {
    const request = this.request(options.timeout);
    const result = unwrapApiResult(
      await getFileContent({
        ...request,
        path: { ...request.path, fileId },
        query: {
          ...query,
          locale: query.locale && this.resolveServiceLocale(query.locale),
        },
      })
    );
    const decoded = {
      ...result,
      data:
        result.data === null
          ? null
          : decodeFileContent(result.data, result.fileFormat),
    };
    return result.locale ? { ...decoded, locale: query.locale } : decoded;
  }

  /**
   * Reads the decoded content of source files and translations, in batches the
   * server accepts. A selector without `locale` reads the source file.
   *
   * @param files - Selectors sharing a file ID, branch ID, version ID, and resolved locale share one request result.
   * @returns One result per selector, in selector order: `ready`, `pending`, or `not_found`. A ready
   * media file over 20MB has `data: null` and a `downloadUrl` to pass to `fetchFileDownload()`.
   */
  async queryFilesContent(
    files: QueryFilesContentData['body']['files'],
    options: { timeout?: number } = {}
  ): Promise<QueryFilesContentResponse> {
    const results = await this.queryEachSelector(files, (distinct) =>
      processBatches(distinct, async (batch) => {
        const response = unwrapApiResult(
          await queryFilesContent({
            ...this.request(options.timeout),
            body: { files: batch.map((file) => this.toFileSelector(file)) },
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

  /**
   * Opens the signed `downloadUrl` that `getFileContent()` and
   * `queryFilesContent()` return instead of `data` for media too large to
   * return inline. The URL works for 15 minutes; read the content again for a
   * new one.
   *
   * @returns The file as a stream, so it can be saved without holding it in memory. Cancel a stream you do not read.
   * @throws {ApiError} If the URL is rejected, with the HTTP status.
   */
  async fetchFileDownload(
    downloadUrl: string
  ): Promise<ReadableStream<Uint8Array>> {
    return fetchFileDownload(downloadUrl);
  }

  /**
   * Updates source files, or their translations when a file names a locale,
   * such as a version's preview URL. Each request of up to 100 files writes all
   * or nothing; a failed request throws.
   *
   * @param files - The file versions and translations to update; each branch, file, version, and locale may appear once.
   * @returns The updated files, in request order.
   */
  async updateFiles(
    files: UpdateFilesData['body']['files'],
    options: { timeout?: number } = {}
  ): Promise<UpdateFilesResponse> {
    const updates = files.map((file) =>
      file.locale === undefined
        ? file
        : { ...file, locale: this.resolveServiceLocale(file.locale) }
    );
    // Two updates to one target in separate concurrent batches would leave it
    // to whichever request finishes last.
    const targets = new Set(
      updates.map(({ branchId, fileId, versionId, locale }) =>
        JSON.stringify([branchId, fileId, versionId, locale])
      )
    );
    if (targets.size !== updates.length) {
      throw new Error(
        createDiagnosticMessage({
          source: 'generaltranslation',
          severity: 'Error',
          whatHappened:
            'Each branch, file, version, and locale may appear once in an update list',
          fix: 'Send each file version or translation once, with the values it should end with',
        })
      );
    }
    const updated = await processBatches(updates, async (batch) => {
      const response = unwrapApiResult(
        await updateFiles({
          ...this.request(options.timeout),
          body: { files: batch },
        })
      );
      return response.files.map((file) => this.aliasLocale(file));
    });
    return { files: updated };
  }

  // -------------- Upload Methods -------------- //

  /**
   * Uploads source files to the translation service without any translation content,
   * in batches the server accepts. A file can fail on its own; check
   * `summary.failed` and each result's `status`.
   *
   * @param files - The source files to upload.
   * @param options - The source locale, which defaults to `localeConfig.defaultLocale` and then to the project's default locale, and timeout.
   * @returns The summary and one result per file, in request order.
   */
  async uploadSourceFiles(
    files: { source: FileUpload }[],
    options: { sourceLocale?: string; timeout?: number } = {}
  ): Promise<UploadSourceFilesResponse> {
    const sourceLocale =
      options.sourceLocale ?? this.localeConfig.defaultLocale;
    return writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) => {
        const request = this.request(options.timeout);
        const contents = await uploadFileContents(
          request,
          batch.map(({ source }) => source)
        );
        return unwrapApiResult(
          await uploadSourceFiles({
            ...request,
            body: {
              data: batch.map(
                (
                  {
                    source: {
                      content: _,
                      formatMetadata: _metadata,
                      ...source
                    },
                  },
                  index
                ) => ({
                  source: {
                    ...source,
                    ...contents[index],
                    locale: this.resolveServiceLocale(source.locale),
                  },
                })
              ),
              ...(sourceLocale !== undefined && {
                sourceLocale: this.resolveServiceLocale(sourceLocale),
              }),
            },
          })
        );
      },
      ({ source }, failure) => [
        {
          branchId: source.branchId ?? '',
          fileId: source.fileId ?? '',
          versionId: source.versionId ?? '',
          fileName: source.fileName,
          fileFormat: source.fileFormat,
          status: 'failed' as const,
          ...failure,
        },
      ],
      // Each batch stages up to four PUTs; one batch at a time keeps that the limit.
      { parallel: false }
    );
  }

  /**
   * Uploads translation files that correspond to previously uploaded source files,
   * in batches the server accepts. A translation can fail on its own; check
   * `summary.failed` and each result's `status`.
   *
   * @param files - Each source file, with its content, and its translations.
   * @returns The summary and one result per translation, in request order.
   */
  async uploadTranslations(
    files: { source: FileUpload; translations: TranslationUpload[] }[],
    options: { timeout?: number } = {}
  ): Promise<UploadTranslationsResponse> {
    const response = await writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) => {
        const request = this.request(options.timeout);
        // A translation upload never takes its source's formatMetadata.
        const contents = await uploadFileContents(
          request,
          batch.flatMap(
            ({ source: { formatMetadata: _, ...source }, translations }) => [
              source,
              ...translations,
            ]
          )
        );
        let next = 0;
        return unwrapApiResult(
          await uploadTranslations({
            ...request,
            body: {
              data: batch.map(
                ({
                  source: { content: _, formatMetadata: _metadata, ...source },
                  translations,
                }) => ({
                  source: {
                    ...source,
                    ...contents[next++],
                    locale: this.resolveServiceLocale(source.locale),
                  },
                  translations: translations.map(
                    ({ content: _, ...translation }) => ({
                      ...translation,
                      ...contents[next++],
                      locale: this.resolveServiceLocale(translation.locale),
                    })
                  ),
                })
              ),
            },
          })
        );
      },
      ({ source, translations }, failure) =>
        translations.map(({ fileName, fileFormat, locale }) => ({
          branchId: source.branchId ?? '',
          fileId: source.fileId ?? '',
          versionId: source.versionId ?? '',
          fileName,
          fileFormat,
          locale: this.resolveServiceLocale(locale),
          status: 'failed' as const,
          ...failure,
        })),
      { parallel: false }
    );
    return {
      ...response,
      results: response.results.map((item) => this.aliasLocale(item)),
    };
  }
}
