import {
  awaitJobs,
  createBranch,
  createProjectApiKey,
  DEFAULT_BATCH_SIZE,
  generateProjectContext,
  getFileContent,
  getFileStatus,
  getJob,
  getProject,
  listBranchFiles,
  listBranches,
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
  updateProject,
  uploadSourceFiles,
  uploadTranslations,
  type AwaitJobsOptions,
  type AwaitJobsResult,
  type CreateBranchData,
  type CreateBranchResponse,
  type CreateProjectApiKeyData,
  type CreateProjectApiKeyResponse,
  type GenerateProjectContextData,
  type GenerateProjectContextResponse,
  type GetFileContentData,
  type GetFileContentResponse,
  type GetFileStatusData,
  type GetFileStatusResponse,
  type GetJobResponse,
  type GetProjectResponse,
  type ListBranchesData,
  type ListBranchesResponse,
  type ListBranchFilesData,
  type ListBranchFilesResponse,
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
import { createDiagnosticMessage } from './logging/diagnostics';
import type { GTProjectConfig } from './clientConfig';
import { GTRuntime } from './runtime';
import { validateModelProvider } from './translate/modelProvider';
import type { MoveMapping } from './translate/moveFiles';
import type { PublishFileEntry } from './translate/publishFiles';
import { unwrapApiResult } from './translate/utils/unwrapApiResult';
import { validateFileFormatTransforms } from './translate/utils/validateFileFormatTransform';
import type { FileUpload } from './types-dir/api/uploadFiles';
import { decodeFileContent, encodeFileContent } from './utils/base64';

// The server accepts at most 25 moves per request.
const MOVE_FILES_BATCH_SIZE = 25;

/**
 * Project and file operations, plus runtime translation, for one project: the
 * project-scoped `new GT({ projectId })` and `account.project(projectId)`.
 */
export class ProjectHandle extends GTRuntime {
  private readonly params: Readonly<GTProjectConfig>;
  private readonly client: ReturnType<typeof createGtApiClient>;

  /** @internal */
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
   * service code and there is no request context to disambiguate them, the
   * first configured identity wins.
   */
  private restoreLocale(locale: string): string {
    const { locales, defaultLocale, customMapping } = this.localeConfig;
    const aliased = resolveAliasLocale(locale, customMapping);
    const canonical = standardizeLocale(locale);
    const configured = [
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

  private aliasLocale<T extends { locale?: string }>(item: T): T {
    return item.locale
      ? {
          ...item,
          locale: resolveAliasLocale(
            item.locale,
            this.localeConfig.customMapping
          ),
        }
      : item;
  }

  private aliasJobSubject<
    T extends { id: string; subject?: { type: string; locale?: string } },
  >(job: T): T {
    return job.subject
      ? { ...job, subject: this.aliasLocale(job.subject) }
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
   * permissions. The returned `apiKey.key` is shown only once.
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
    return writeInBatches(moves, MOVE_FILES_BATCH_SIZE, async (batch) =>
      unwrapApiResult(
        await moveFiles({
          ...this.request(options.timeout),
          body: { branchId: options.branchId, moves: batch },
        })
      )
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
      return response.jobs.map((job) => this.aliasJobSubject(job));
    });
    return { jobs };
  }

  /**
   * Creates or replaces a tag: points `tagId` at exactly the given source file
   * versions and sets its message (omitted clears it).
   *
   * @param tagId - The tag name, unique within the project.
   * @param body - The tagged file versions and optional message.
   * @returns The tag, and whether this request `created` it.
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
        )
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
        )
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
   * the read is a 404, so wait for the job with `awaitJobs` or `getJob` first.
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
   * @returns One result per selector, in selector order: `ready`, `pending`, or `not_found`.
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
    return writeInBatches(files, DEFAULT_BATCH_SIZE, async (batch) =>
      unwrapApiResult(
        await uploadSourceFiles({
          ...this.request(options.timeout),
          body: {
            data: batch.map(({ source }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
                locale: this.resolveServiceLocale(source.locale),
              },
            })),
            ...(sourceLocale !== undefined && {
              sourceLocale: this.resolveServiceLocale(sourceLocale),
            }),
          },
        })
      )
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
    files: { source: FileUpload; translations: FileUpload[] }[],
    options: { timeout?: number } = {}
  ): Promise<UploadTranslationsResponse> {
    validateFileFormatTransforms(files.map(({ source }) => source));
    const response = await writeInBatches(
      files,
      DEFAULT_BATCH_SIZE,
      async (batch) =>
        unwrapApiResult(
          await uploadTranslations({
            ...this.request(options.timeout),
            body: {
              data: batch.map(({ source, translations }) => ({
                source: {
                  ...source,
                  content: encodeFileContent(source.content, source.fileFormat),
                  locale: this.resolveServiceLocale(source.locale),
                },
                translations: translations.map((translation) => ({
                  ...translation,
                  locale: this.resolveServiceLocale(translation.locale),
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
    return {
      ...response,
      results: response.results.map((item) => this.aliasLocale(item)),
    };
  }
}
