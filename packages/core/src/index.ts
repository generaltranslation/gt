// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

// ----- IMPORTS ----- //

import {
  type AwaitJobsOptions,
  type AwaitJobsResult,
  type CreateBranchData,
  type CreateBranchResponse,
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
  type UpsertAssetsData,
  type UpsertAssetsResponse,
} from '@generaltranslation/api';
import { libraryDefaultLocale } from './settings/settings';
import { defaultBaseUrl } from './settings/settingsUrls';
import type { FileUpload } from './types-dir/api/uploadFiles';
import type { MoveMapping } from './translate/moveFiles';
import type { PublishFileEntry } from './translate/publishFiles';
import { createGtApiAdapter, type GtApiAdapter } from './adapter/createGtApi';
import { GTRuntime, type GTConstructorParams } from './runtime';
import { validateAuth } from './translate/runtimeTranslate';

export { GTRuntime, type GTConstructorParams } from './runtime';
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';

export {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from '@generaltranslation/format';

export {
  determineLocale,
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  getLocaleDirection,
  getLocaleEmoji,
  getLocaleName,
  getLocaleProperties,
  getRegionProperties,
  isSameDialect,
  isSameLanguage,
  isSupersetLocale,
  isValidLocale,
  requiresTranslation,
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';

// ============================================================ //
//                        Core Class                            //
// ============================================================ //

/**
 * GT is the core driver for the General Translation library.
 * It extends {@link GTRuntime} (locale management, formatting, and runtime
 * translation) with the project and file management API client used by
 * tooling such as the CLI.
 *
 * Browser-facing SDK code should construct {@link GTRuntime} instead so
 * production bundles do not ship the file management client.
 *
 * @class GT
 * @description A comprehensive toolkit for handling internationalization and localization.
 *
 * @example
 * const gt = new GT({
 *   sourceLocale: 'en-US',
 *   targetLocale: 'es-ES',
 *   locales: ['en-US', 'es-ES', 'fr-FR']
 * });
 */
export class GT extends GTRuntime {
  // Built lazily from the current config. `setConfig` is the only supported
  // way to change those fields after construction, so it is the only place the
  // cache is dropped; assigning `gt.apiKey` etc. directly does not rebuild it.
  private _apiAdapter?: GtApiAdapter;

  setConfig(params: GTConstructorParams) {
    // GTRuntime writes credentials before it validates locales, so drop the
    // cache even when validation throws.
    try {
      super.setConfig(params);
    } finally {
      this._apiAdapter = undefined;
    }
  }

  private _getApiAdapter(): GtApiAdapter {
    this._apiAdapter ??= createGtApiAdapter({
      apiKey: this.apiKey,
      userTokenProvider: this.userTokenProvider,
      baseUrl: this.baseUrl || defaultBaseUrl,
      projectId: this.projectId,
      customMapping: this.customMapping,
    });
    return this._apiAdapter;
  }

  private restoreProjectLocales<
    T extends { defaultLocale: string; currentLocales: string[] },
  >(project: T): T {
    return {
      ...project,
      defaultLocale: this.resolveServiceResponseLocale(project.defaultLocale),
      currentLocales: project.currentLocales.map((locale) =>
        this.resolveServiceResponseLocale(locale)
      ),
    };
  }

  // -------------- Project Methods -------------- //

  /**
   * Fetches the configured project: name, locales, review and CDN settings.
   */
  async getProject(
    options: { timeout?: number } = {}
  ): Promise<GetProjectResponse> {
    validateAuth('getProject', this._getTranslationConfig());
    return this.restoreProjectLocales(
      await this._getApiAdapter().getProject(options)
    );
  }

  /**
   * Updates settings of the configured project. Omitted settings stay unchanged.
   *
   * @param body - The settings to change.
   */
  async updateProject(
    body: UpdateProjectData['body'],
    options: { timeout?: number } = {}
  ): Promise<UpdateProjectResponse> {
    validateAuth('updateProject', this._getTranslationConfig());
    return this.restoreProjectLocales(
      await this._getApiAdapter().updateProject(body, options)
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
    validateAuth('listBranches', this._getTranslationConfig());
    return await this._getApiAdapter().listBranches(query, options);
  }

  /**
   * Creates a branch. If a branch with the name already exists, it is returned;
   * that lookup needs branch read access, so a key without it gets the 409.
   *
   * @param query - The branch `name` and whether it `isDefault`.
   * @returns The created or existing branch.
   */
  async createBranch(
    query: CreateBranchData['body']
  ): Promise<CreateBranchResponse> {
    validateAuth('createBranch', this._getTranslationConfig());
    return await this._getApiAdapter().createBranch(query);
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
    validateAuth('updateBranch', this._getTranslationConfig());
    return await this._getApiAdapter().updateBranch(branchId, body, options);
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
    validateAuth('listBranchFiles', this._getTranslationConfig());
    return await this._getApiAdapter().listBranchFiles(
      branchId,
      query,
      options
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
    validateAuth('moveFiles', this._getTranslationConfig());
    return await this._getApiAdapter().moveFiles(moves, options);
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
    validateAuth('generateProjectContext', this._getTranslationConfig());
    return await this._getApiAdapter().generateProjectContext(files, options);
  }

  /**
   * Reads the statuses of project jobs, in batches the server accepts.
   * A job the project does not have is `not_found`.
   *
   * @param jobIds - The jobs to read; each ID may appear once.
   * @returns One result per job ID, in request order.
   */
  async queryJobs(
    jobIds: string[],
    options: { timeout?: number } = {}
  ): Promise<QueryJobsResponse> {
    validateAuth('queryJobs', this._getTranslationConfig());
    return await this._getApiAdapter().queryJobs(jobIds, options);
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
    validateAuth('getJob', this._getTranslationConfig());
    return await this._getApiAdapter().getJob(jobId, options);
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
    options?: AwaitJobsOptions
  ): Promise<AwaitJobsResult> {
    validateAuth('awaitJobs', this._getTranslationConfig());
    return await this._getApiAdapter().awaitJobs(jobIds, options);
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
    validateAuth('translateFiles', this._getTranslationConfig());
    return await this._getApiAdapter().translateFiles(files, options);
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
    validateAuth('setTag', this._getTranslationConfig());
    return await this._getApiAdapter().setTag(tagId, body);
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
    validateAuth('publishFiles', this._getTranslationConfig());
    const result = await this._getApiAdapter().publishFiles(files);
    return {
      ...result,
      results: result.results.map((item) => ({
        ...item,
        translations: item.translations.map((translation) => ({
          ...translation,
          locale: this.resolveServiceResponseLocale(translation.locale),
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
    validateAuth('overwriteTranslations', this._getTranslationConfig());
    const result = await this._getApiAdapter().overwriteTranslations(
      diffs,
      options
    );
    return {
      ...result,
      results: result.results.map((item, index) => ({
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
    validateAuth('queryFiles', this._getTranslationConfig());
    const { results } = await this._getApiAdapter().queryFiles(files, options);
    return {
      results: results.map((result) => ({
        ...result,
        ...(result.sourceLocale && {
          sourceLocale: this.resolveServiceResponseLocale(result.sourceLocale),
        }),
        ...(result.locales && {
          locales: result.locales.map((locale) =>
            this.resolveServiceResponseLocale(locale)
          ),
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
    validateAuth('getFileStatus', this._getTranslationConfig());
    const result = await this._getApiAdapter().getFileStatus(
      fileId,
      query,
      options
    );
    return {
      translations: result.translations.map((item) => ({
        ...item,
        ...(item.locale && {
          locale: this.resolveServiceResponseLocale(item.locale),
        }),
      })),
      sourceFile: {
        ...result.sourceFile,
        ...(result.sourceFile.sourceLocale && {
          sourceLocale: this.resolveServiceResponseLocale(
            result.sourceFile.sourceLocale
          ),
        }),
        locales: result.sourceFile.locales.map((locale) =>
          this.resolveServiceResponseLocale(locale)
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
    validateAuth('getFileContent', this._getTranslationConfig());
    const result = await this._getApiAdapter().getFileContent(
      fileId,
      query,
      options
    );
    return result.locale ? { ...result, locale: query.locale } : result;
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
    validateAuth('queryFilesContent', this._getTranslationConfig());
    return await this._getApiAdapter().queryFilesContent(files, options);
  }

  // -------------- Upload Methods -------------- //

  /**
   * Uploads source files to the translation service without any translation content,
   * in batches the server accepts. A file can fail on its own; check
   * `summary.failed` and each result's `status`.
   *
   * @param {Array<{source: FileUpload}>} files - Array of objects containing source file data to upload
   * @param options - The source locale and timeout.
   * @returns {Promise<UploadSourceFilesResponse>} The summary and one result per file, in request order.
   */
  async uploadSourceFiles(
    files: { source: FileUpload }[],
    options: { sourceLocale: string; timeout?: number }
  ): Promise<UploadSourceFilesResponse> {
    validateAuth('uploadSourceFiles', this._getTranslationConfig());

    return await this._getApiAdapter().uploadSourceFiles(
      files.map((f) => ({
        ...f,
        source: {
          ...f.source,
          locale: this.resolveServiceLocale(f.source.locale),
        },
      })),
      {
        ...options,
        sourceLocale: this.resolveServiceLocale(
          options.sourceLocale ?? this.sourceLocale ?? libraryDefaultLocale
        ),
      }
    );
  }

  /**
   * Uploads fonts used when translating formats that need the source font.
   * Persistent and reused across translation jobs for the project's
   * organization, in batches the server accepts. A font can fail on its own;
   * check `summary.failed` and each result's `status`.
   *
   * @param assets - Fonts to upload (`content` base64-encoded).
   * @returns The summary and one result per font, in request order.
   */
  async upsertAssets(
    assets: UpsertAssetsData['body']['assets'],
    options: { timeout?: number } = {}
  ): Promise<UpsertAssetsResponse> {
    validateAuth('upsertAssets', this._getTranslationConfig());
    return await this._getApiAdapter().upsertAssets(assets, options);
  }

  /**
   * Uploads translation files that correspond to previously uploaded source files,
   * in batches the server accepts. A translation can fail on its own; check
   * `summary.failed` and each result's `status`.
   *
   * @param {Array<{source: FileUpload, translations: FileUpload[]}>} files - Array of file objects where:
   *   - `source`: Reference to the existing source file (contains IDs but no content).
   *   - `translations`: Array of translated files, each containing content, locale, and reference IDs
   * @returns {Promise<UploadTranslationsResponse>} The summary and one result per translation, in request order.
   */
  async uploadTranslations(
    files: {
      source: FileUpload; // reference only (no content)
      translations: FileUpload[]; // each has content + ids + locale
    }[],
    options: { timeout?: number } = {}
  ): Promise<UploadTranslationsResponse> {
    validateAuth('uploadTranslations', this._getTranslationConfig());

    return await this._getApiAdapter().uploadTranslations(
      files.map((f) => ({
        ...f,
        source: {
          ...f.source,
          locale: this.resolveServiceLocale(f.source.locale),
        },
        translations: f.translations.map((t) => ({
          ...t,
          locale: this.resolveServiceLocale(t.locale),
        })),
      })),
      { timeout: options.timeout }
    );
  }
}
