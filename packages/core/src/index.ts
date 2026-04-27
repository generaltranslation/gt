// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

// ----- IMPORTS ----- //

import {
  CustomMapping,
  TranslateManyResult,
  TranslationError,
  TranslationRequestConfig,
  TranslationResult,
  EnqueueFilesResult,
  CheckFileTranslationsOptions,
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
  DownloadFileOptions,
  TranslateManyEntry,
} from './types';
import { libraryDefaultLocale } from './internal';
import {
  noSourceLocaleProvidedError,
  noTargetLocaleProvidedError,
  noProjectIdProvidedError,
  noApiKeyProvidedError,
} from './logging/errors';
import { gtInstanceLogger } from './logging/logger';
import _translateMany from './translate/translateMany';
import _setupProject, {
  SetupProjectResult,
  SetupProjectOptions,
} from './translate/setupProject';
import _enqueueFiles, { EnqueueOptions } from './translate/enqueueFiles';
import _createTag, {
  CreateTagOptions,
  CreateTagResult,
} from './translate/createTag';
import _downloadFileBatch from './translate/downloadFileBatch';
import {
  FileQuery,
  FileQueryResult,
} from './types-dir/api/checkFileTranslations';
import _submitUserEditDiffs, {
  SubmitUserEditDiffsPayload,
} from './translate/submitUserEditDiffs';
import _uploadSourceFiles from './translate/uploadSourceFiles';
import _uploadTranslations from './translate/uploadTranslations';
import {
  FileUpload,
  RequiredUploadFilesOptions,
  UploadFilesOptions,
  UploadFilesResponse,
} from './types-dir/api/uploadFiles';
import _querySourceFile from './translate/querySourceFile';
import { ProjectData } from './types-dir/api/project';
import _getProjectData from './projects/getProjectData';
import { DownloadFileBatchRequest } from './types-dir/api/downloadFileBatch';
import {
  _checkJobStatus,
  CheckJobStatusResult,
} from './translate/checkJobStatus';
import _awaitJobs, {
  AwaitJobsOptions,
  AwaitJobsResult,
} from './translate/awaitJobs';
import type { FileDataQuery, FileDataResult } from './translate/queryFileData';
import _queryFileData from './translate/queryFileData';
import type { BranchQuery } from './translate/queryBranchData';
import type { BranchDataResult } from './types-dir/api/branch';
import _queryBranchData from './translate/queryBranchData';
import type {
  CreateBranchQuery,
  CreateBranchResult,
} from './translate/createBranch';
import _createBranch from './translate/createBranch';
import type { FileReference, FileReferenceIds } from './types-dir/api/file';
import _processFileMoves, {
  type MoveMapping,
  type ProcessMovesResponse,
  type ProcessMovesOptions,
} from './translate/processFileMoves';
import _getOrphanedFiles, {
  type GetOrphanedFilesResult,
} from './translate/getOrphanedFiles';
import _publishFiles, {
  type PublishFileEntry,
  type PublishFilesResult,
} from './translate/publishFiles';
import { TranslateOptions } from './types-dir/api/entry';
import { API_VERSION as _API_VERSION } from './translate/api';

// Re-export everything from format.ts
export * from './format';

import { GTFormatter } from './format';

// ============================================================ //
//                        Core Class                            //
// ============================================================ //

/**
 * Type representing the constructor parameters for the GT class.
 * @typedef {Object} GTConstructorParams
 * @property {string} [apiKey] - The API key for accessing the translation service
 * @property {string} [devApiKey] - The development API key for accessing the translation service
 * @property {string} [sourceLocale] - The default source locale for translations
 * @property {string} [targetLocale] - The default target locale for translations
 * @property {string[]} [locales] - Array of supported locales
 * @property {string} [projectId] - The project ID for the translation service
 * @property {string} [baseUrl] - The base URL for the translation service
 * @property {CustomMapping} [customMapping] - Custom mapping of locale codes to their names
 */
type GTConstructorParams = {
  apiKey?: string;
  devApiKey?: string;
  sourceLocale?: string;
  targetLocale?: string;
  locales?: string[];
  projectId?: string;
  baseUrl?: string;
  customMapping?: CustomMapping;
};

/**
 * GT is the core driver for the General Translation library.
 * This class provides functionality for locale management, formatting, and translation operations.
 * It extends GTFormatter with API client methods for server-side use.
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
export class GT extends GTFormatter {
  /** Base URL for the translation service API */
  baseUrl?: string;

  /** Project ID for the translation service */
  projectId?: string;

  /** API key for accessing the translation service */
  apiKey?: string;

  /** Development API key for accessing the translation service */
  devApiKey?: string;

  /**
   * Constructs an instance of the GT class.
   *
   * @param {GTConstructorParams} [params] - The parameters for initializing the GT instance
   * @throws {Error} If an invalid locale is provided
   * @throws {Error} If any of the provided locales are invalid
   *
   * @example
   * const gt = new GT({
   *   apiKey: 'your-api-key',
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   */
  constructor(params: GTConstructorParams = {}) {
    // Set up config
    super(params);
    // Read environment
    if (typeof process !== 'undefined') {
      this.apiKey ||= process.env?.GT_API_KEY;
      this.devApiKey ||= process.env?.GT_DEV_API_KEY;
      this.projectId ||= process.env?.GT_PROJECT_ID;
    }
  }

  override setConfig(params: GTConstructorParams) {
    // ----- Environment properties ----- //

    // Set API-specific properties
    if (params.apiKey) this.apiKey = params.apiKey;
    if (params.devApiKey) this.devApiKey = params.devApiKey;
    if (params.projectId) this.projectId = params.projectId;
    if (params.baseUrl) this.baseUrl = params.baseUrl;

    // Delegate locale/formatting config to parent
    super.setConfig(params);
  }

  // -------------- Private Methods -------------- //

  private _getTranslationConfig(): TranslationRequestConfig {
    return {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey || this.devApiKey,
      projectId: this.projectId || '',
    };
  }

  private _validateAuth(functionName: string) {
    const errors: string[] = [];
    if (!this.apiKey && !this.devApiKey) {
      const error = noApiKeyProvidedError(functionName);
      errors.push(error);
    }
    if (!this.projectId) {
      const error = noProjectIdProvidedError(functionName);
      errors.push(error);
    }
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }
  }

  // -------------- Branch Methods -------------- //

  /**
   * Queries branch information from the API.
   *
   * @param {BranchQuery} query - Object mapping the current branch and incoming branches
   * @returns {Promise<BranchDataResult>} The branch information
   */
  async queryBranchData(query: BranchQuery): Promise<BranchDataResult> {
    this._validateAuth('queryBranchData');
    return await _queryBranchData(query, this._getTranslationConfig());
  }

  /**
   * Creates a new branch in the API. If the branch already exists, it will be returned.
   *
   * @param {CreateBranchQuery} query - Object mapping the branch name and default branch flag
   * @returns {Promise<CreateBranchResult>} The created branch information
   */
  async createBranch(query: CreateBranchQuery): Promise<CreateBranchResult> {
    this._validateAuth('createBranch');
    return await _createBranch(query, this._getTranslationConfig());
  }

  /**
   * Processes file moves by cloning source files and translations with new fileIds.
   * This is called when files have been moved/renamed and we want to preserve translations.
   *
   * @param {MoveMapping[]} moves - Array of move mappings (old fileId to new fileId)
   * @param {ProcessMovesOptions} options - Options including branchId and timeout
   * @returns {Promise<ProcessMovesResponse>} The move processing results
   *
   * @example
   * const result = await gt.processFileMoves([
   *   { oldFileId: 'abc123', newFileId: 'def456', newFileName: 'locales/en.json' }
   * ], { branchId: 'main' });
   */
  async processFileMoves(
    moves: MoveMapping[],
    options: ProcessMovesOptions = {}
  ): Promise<ProcessMovesResponse> {
    this._validateAuth('processFileMoves');
    return await _processFileMoves(
      moves,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Gets orphaned files for a branch - files that exist on the branch
   * but whose fileIds are not in the provided list.
   * Used for move detection.
   *
   * @param {string} branchId - The branch to check for orphaned files
   * @param {string[]} fileIds - List of current file IDs (files that are NOT orphaned)
   * @param {Object} options - Options including timeout
   * @returns {Promise<GetOrphanedFilesResult>} The orphaned files
   *
   * @example
   * const result = await gt.getOrphanedFiles('branch-id', ['file-1', 'file-2']);
   */
  async getOrphanedFiles(
    branchId: string,
    fileIds: string[],
    options: { timeout?: number } = {}
  ): Promise<GetOrphanedFilesResult> {
    this._validateAuth('getOrphanedFiles');
    return await _getOrphanedFiles(
      branchId,
      fileIds,
      options,
      this._getTranslationConfig()
    );
  }

  // -------------- Translation Methods -------------- //

  /**
   * Enqueues project setup job using the specified file references
   *
   * This method creates setup jobs that will process source file references
   * and generate a project setup. The files parameter contains references (IDs) to source
   * files that have already been uploaded via uploadSourceFiles. The setup jobs are queued
   * for processing and will generate a project setup based on the source files.
   *
   * @param {FileReference[]} files - Array of file references containing IDs of previously uploaded source files
   * @param {SetupProjectOptions} [options] - Optional settings for target locales and timeout
   * @returns {Promise<SetupProjectResult>} Object containing the jobId and status
   */
  async setupProject(
    files: FileReference[],
    options?: SetupProjectOptions
  ): Promise<SetupProjectResult> {
    this._validateAuth('setupProject');
    options = {
      ...options,
      locales: options?.locales?.map((locale) =>
        this.resolveCanonicalLocale(locale)
      ),
    };
    return await _setupProject(files, this._getTranslationConfig(), options);
  }

  /**
   * Checks the current status of one or more project jobs by their unique identifiers.
   *
   * This method polls the API to determine whether one or more jobs are still running,
   * have completed successfully, or have failed. Jobs are created after calling either enqueueFiles or setupProject.
   *
   * @param {string[]} jobIds - The unique identifiers of the jobs to check
   * @param {number} [timeoutMs] - Optional timeout in milliseconds for the API request
   * @returns {Promise<CheckJobStatusResult>} Object containing the job status
   *
   * @example
   * const result = await gt.checkJobStatus([
   *   'job-123',
   *   'job-456',
   * ], {
   *   timeout: 10000,
   * });
   */
  async checkJobStatus(
    jobIds: string[],
    timeoutMs?: number
  ): Promise<CheckJobStatusResult> {
    this._validateAuth('checkJobStatus');
    return await _checkJobStatus(
      jobIds,
      this._getTranslationConfig(),
      timeoutMs
    );
  }

  /**
   * Polls job statuses until all jobs from enqueueFiles are finished or the timeout is reached.
   *
   * @param {EnqueueFilesResult} enqueueResult - The result returned from enqueueFiles
   * @param {AwaitJobsOptions} [options] - Polling configuration (interval, timeout)
   * @returns {Promise<AwaitJobsResult>} The final status of all jobs and whether they all completed
   */
  async awaitJobs(
    enqueueResult: EnqueueFilesResult,
    options?: AwaitJobsOptions
  ): Promise<AwaitJobsResult> {
    this._validateAuth('awaitJobs');
    return await _awaitJobs(
      enqueueResult,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Enqueues translation jobs for previously uploaded source files.
   *
   * This method creates translation jobs that will process existing source files
   * and generate translations in the specified target languages. The files parameter
   * contains references (IDs) to source files that have already been uploaded via
   * uploadSourceFiles. The translation jobs are queued for processing and will
   * generate translated content based on the source files and target locales provided.
   *
   * @param {FileReferenceIds[]} files - Array of file references containing IDs of previously uploaded source files
   * @param {EnqueueOptions} options - Configuration options including source locale, target locales, and job settings
   * @returns {Promise<EnqueueFilesResult>} Result containing job IDs, queue status, and processing information
   */
  async enqueueFiles(
    files: FileReferenceIds[],
    options: EnqueueOptions
  ): Promise<EnqueueFilesResult> {
    // Validation
    this._validateAuth('enqueueFiles');

    // Merge instance settings with options
    let mergedOptions: EnqueueOptions = {
      ...options,
      sourceLocale: options.sourceLocale ?? this.sourceLocale!,
      targetLocales: options.targetLocales ?? [this.targetLocale!],
    };

    // Require source locale
    if (!mergedOptions.sourceLocale) {
      const error = noSourceLocaleProvidedError('enqueueFiles');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Require target locale(s)
    if (
      !mergedOptions.targetLocales ||
      mergedOptions.targetLocales.length === 0
    ) {
      const error = noTargetLocaleProvidedError('enqueueFiles');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Replace target locales with canonical locales
    mergedOptions = {
      ...mergedOptions,
      targetLocales: mergedOptions.targetLocales.map((locale) =>
        this.resolveCanonicalLocale(locale)
      ),
    };

    return await _enqueueFiles(
      files,
      mergedOptions,
      this._getTranslationConfig()
    );
  }

  /**
   * Creates or upserts a file tag, associating a set of source files
   * with a user-defined tag ID and optional message.
   *
   * @param {CreateTagOptions} options - Tag creation options including tagId, sourceFileIds, and optional message
   * @returns {Promise<CreateTagResult>} The created or updated tag
   */
  async createTag(options: CreateTagOptions): Promise<CreateTagResult> {
    this._validateAuth('createTag');
    return await _createTag(options, this._getTranslationConfig());
  }

  /**
   * Publishes or unpublishes files on the CDN.
   *
   * @param {PublishFileEntry[]} files - Array of file entries with publish flags
   * @returns {Promise<PublishFilesResult>} Result containing per-file success/failure
   */
  async publishFiles(files: PublishFileEntry[]): Promise<PublishFilesResult> {
    this._validateAuth('publishFiles');
    return await _publishFiles(files, this._getTranslationConfig());
  }

  /**
   * Submits user edit diffs for existing translations so future generations preserve user intent.
   *
   * @param {SubmitUserEditDiffsPayload} payload - Project-scoped diff payload.
   * @returns {Promise<void>} Resolves when submission succeeds.
   */
  async submitUserEditDiffs(
    payload: SubmitUserEditDiffsPayload
  ): Promise<void> {
    this._validateAuth('submitUserEditDiffs');
    // Normalize locales to canonical form before submission
    const normalized: SubmitUserEditDiffsPayload = {
      ...payload,
      diffs: (payload.diffs || []).map((d) => ({
        ...d,
        locale: this.resolveCanonicalLocale(d.locale),
      })),
    };
    await _submitUserEditDiffs(normalized, this._getTranslationConfig());
  }

  /**
   * Queries data about one or more source or translation files.
   *
   * @param {FileDataQuery} data - Object mapping source and translation file information.
   * @param {CheckFileTranslationsOptions} options - Options for the API call.
   * @returns {Promise<FileDataResult>} The source and translation file data information.
   *
   * @example
   * const result = await gt.queryFileData({
   *   sourceFiles: [
   *     { fileId: '1234567890', versionId: '1234567890', branchId: '1234567890' },
   *   ],
   *   translatedFiles: [
   *     { fileId: '1234567890', versionId: '1234567890', branchId: '1234567890', locale: 'es-ES' },
   *   ],
   * }, {
   *   timeout: 10000,
   * });
   *
   */
  async queryFileData(
    data: FileDataQuery,
    options: CheckFileTranslationsOptions = {}
  ): Promise<FileDataResult> {
    // Validation
    this._validateAuth('queryFileData');

    // Replace target locales with canonical locales
    data.translatedFiles = data.translatedFiles?.map((item) => ({
      ...item,
      locale: this.resolveCanonicalLocale(item.locale),
    }));

    // Request the file translation status
    const result = await _queryFileData(
      data,
      options,
      this._getTranslationConfig()
    );

    // Resolve canonical locales
    result.translatedFiles = result.translatedFiles?.map((item) => ({
      ...item,
      ...(item.locale && { locale: this.resolveAliasLocale(item.locale) }),
    }));
    result.sourceFiles = result.sourceFiles?.map((item) => ({
      ...item,
      ...(item.sourceLocale && {
        sourceLocale: this.resolveAliasLocale(item.sourceLocale),
      }),
      locales: item.locales.map((locale) => this.resolveAliasLocale(locale)),
    }));
    return result;
  }

  /**
   * Gets source and translation information for a given file ID and version ID.
   *
   * @param {FileQuery} data - File query containing file ID and version ID.
   * @param {CheckFileTranslationsOptions} options - Options for getting source and translation information.
   * @returns {Promise<FileQueryResult>} The source file and translation information.
   *
   * @example
   * const result = await gt.querySourceFile(
   *   { fileId: '1234567890', versionId: '1234567890' },
   *   { timeout: 10000 }
   * );
   *
   */
  async querySourceFile(
    data: FileQuery,
    options: CheckFileTranslationsOptions = {}
  ): Promise<FileQueryResult> {
    // Validation
    this._validateAuth('querySourceFile');

    // Request the file translation status
    const result = await _querySourceFile(
      data,
      options,
      this._getTranslationConfig()
    );
    // Replace locales with canonical locales
    result.translations = result.translations.map((item) => ({
      ...item,
      ...(item.locale && { locale: this.resolveAliasLocale(item.locale) }),
    }));
    result.sourceFile.locales = result.sourceFile.locales.map((locale) =>
      this.resolveAliasLocale(locale)
    );
    if (result.sourceFile.sourceLocale) {
      result.sourceFile.sourceLocale = this.resolveAliasLocale(
        result.sourceFile.sourceLocale
      );
    }
    return result;
  }

  /**
   * Get project data for a given project ID.
   *
   * @param {string} projectId - The ID of the project to get the data for.
   * @returns {Promise<ProjectData>} The project data.
   *
   * @example
   * const result = await gt.getProjectData(
   *   '1234567890'
   * );
   *
   */
  async getProjectData(
    projectId: string,
    options: { timeout?: number } = {}
  ): Promise<ProjectData> {
    // Validation
    this._validateAuth('getProjectData');

    // Request the file translation status
    const result = await _getProjectData(
      projectId,
      options,
      this._getTranslationConfig()
    );
    // Replace locales with canonical locales
    result.currentLocales = result.currentLocales.map((item) =>
      this.resolveAliasLocale(item)
    );
    result.defaultLocale = this.resolveAliasLocale(result.defaultLocale);
    return result;
  }

  /**
   * Downloads a single file.
   *
   * @param file - The file query object.
   * @param {string} file.fileId - The ID of the file to download.
   * @param {string} [file.branchId] - The ID of the branch to download the file from. If not provided, the default branch will be used.
   * @param {string} [file.locale] - The locale to download the file for. If not provided, the source file will be downloaded.
   * @param {string} [file.versionId] - The version ID to download the file from. If not provided, the latest version will be used.
   * @param {DownloadFileOptions} options - Options for downloading the file.
   * @returns {Promise<string>} The downloaded file content.
   *
   * @example
   * const result = await gt.downloadFile({
   *   fileId: '1234567890',
   *   branchId: '1234567890',
   *   locale: 'es-ES',
   *   versionId: '1234567890',
   * }, {
   *   timeout: 10000,
   * });
   */
  async downloadFile(
    file: {
      fileId: string;
      branchId?: string;
      locale?: string;
      versionId?: string;
      useLatestAvailableVersion?: boolean;
    },
    options: DownloadFileOptions = {}
  ): Promise<string> {
    // Validation
    this._validateAuth('downloadTranslatedFile');

    const result = await _downloadFileBatch(
      [
        {
          fileId: file.fileId,
          branchId: file.branchId,
          locale: file.locale
            ? this.resolveCanonicalLocale(file.locale)
            : undefined,
          versionId: file.versionId,
          useLatestAvailableVersion: file.useLatestAvailableVersion,
        },
      ],
      options,
      this._getTranslationConfig()
    );
    return result.data?.[0]?.data ?? '';
  }

  /**
   * Downloads multiple files in a batch.
   *
   * @param {DownloadFileBatchRequest} requests - Array of file query objects to download.
   * @param {DownloadFileBatchOptions} options - Options for the batch download.
   * @returns {Promise<DownloadFileBatchResult>} The batch download results.
   *
   * @example
   * const result = await gt.downloadFileBatch([{
   *   fileId: '1234567890',
   *   locale: 'es-ES',
   *   versionId: '1234567890',
   * }], {
   *   timeout: 10000,
   * });
   */
  async downloadFileBatch(
    requests: DownloadFileBatchRequest,
    options: DownloadFileBatchOptions = {}
  ): Promise<DownloadFileBatchResult> {
    // Validation
    this._validateAuth('downloadFileBatch');

    requests = requests.map((request) => ({
      ...request,
      locale: request.locale
        ? this.resolveCanonicalLocale(request.locale)
        : undefined,
    }));

    // Request the batch download
    const result = await _downloadFileBatch(
      requests,
      options,
      this._getTranslationConfig()
    );

    return {
      files: result.data.map((file) => ({
        ...file,
        ...(file.locale && {
          locale: this.resolveAliasLocale(file.locale),
        }),
      })),
      count: result.count,
    };
  }

  /**
   * Translates a single source string to the target locale.
   * Routes through {@link translateMany} under the hood.
   *
   * @param {string} source - The source string to translate.
   * @param {object} options - Translation options including targetLocale and optional entry metadata.
   * @returns {Promise<TranslationResult | TranslationError>} The translated content.
   *
   * @example
   * const result = await gt.translate('Hello, world!', { targetLocale: 'es' });
   *
   * @example
   * const result = await gt.translate('Hello, world!', {
   *   targetLocale: 'es',
   *   dataFormat: 'ICU',
   *   context: 'A formal greeting',
   * });
   */
  async translate(
    source: TranslateManyEntry,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslationResult | TranslationError> {
    // Normalize string shorthand to options object
    if (typeof options === 'string') {
      options = { targetLocale: options };
    }

    // Validation
    this._validateAuth('translate');

    // Require target locale
    let targetLocale = options?.targetLocale || this.targetLocale;
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translate');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Replace target locale with canonical locale
    targetLocale = this.resolveCanonicalLocale(targetLocale);

    const sourceLocale = this.resolveCanonicalLocale(
      options?.sourceLocale || this.sourceLocale || libraryDefaultLocale
    );

    // Request the translation
    const results = await _translateMany(
      [source],
      {
        ...options,
        targetLocale,
        sourceLocale,
      },
      this._getTranslationConfig(),
      timeout
    );
    return results[0];
  }

  /**
   * Translates multiple source strings to the target locale.
   * Each entry can be a plain string or an object with source and metadata fields.
   *
   * @param {TranslateManyEntry[] | Record<string, TranslateManyEntry>} sources - The source entries to translate. Can be an array or a record keyed by hash.
   * @param {object} options - Translation options including targetLocale.
   * @returns {Promise<TranslateManyResult | Record<string, TranslationResult>>} The translated contents. An array if sources was an array, a record if sources was a record.
   *
   * @example
   * const result = await gt.translateMany(
   *   ['Hello, world!', 'Goodbye, world!'],
   *   { targetLocale: 'es' }
   * );
   *
   * @example
   * const result = await gt.translateMany(
   *   [{ source: 'Hello, world!', dataFormat: 'ICU' }],
   *   { targetLocale: 'es' }
   * );
   *
   * @example
   * const result = await gt.translateMany(
   *   { 'my-hash': 'Hello, world!' },
   *   { targetLocale: 'es' }
   * );
   */
  async translateMany(
    sources: TranslateManyEntry[],
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult>;
  async translateMany(
    sources: Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<Record<string, TranslationResult>>;
  async translateMany(
    sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult | Record<string, TranslationResult>> {
    // Normalize string shorthand to options object
    if (typeof options === 'string') {
      options = { targetLocale: options };
    }

    // Validation
    this._validateAuth('translateMany');

    // Require target locale
    let targetLocale = options?.targetLocale || this.targetLocale;
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translateMany');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Replace target locale with canonical locale
    targetLocale = this.resolveCanonicalLocale(targetLocale);

    const sourceLocale = this.resolveCanonicalLocale(
      options?.sourceLocale || this.sourceLocale || libraryDefaultLocale
    );

    // Request the translation
    return await _translateMany(
      sources,
      {
        ...options,
        targetLocale,
        sourceLocale,
      },
      this._getTranslationConfig(),
      timeout
    );
  }

  /**
   * Uploads source files to the translation service without any translation content.
   *
   * This method creates or replaces source file entries in your project. Each uploaded
   * file becomes a source that can later be translated into target languages. The files
   * are processed and stored as base entries that serve as the foundation for generating
   * translations through the translation workflow.
   *
   * @param {Array<{source: FileUpload}>} files - Array of objects containing source file data to upload
   * @param {UploadFilesOptions} options - Configuration options including source locale and other upload settings
   * @returns {Promise<UploadFilesResponse>} Upload result containing file IDs, version information, and upload status
   */
  async uploadSourceFiles(
    files: { source: FileUpload }[],
    options: UploadFilesOptions
  ): Promise<UploadFilesResponse> {
    // Validation
    this._validateAuth('uploadSourceFiles');

    // Merge instance settings with options
    const mergedOptions: UploadFilesOptions = {
      ...options,
      sourceLocale: this.resolveCanonicalLocale(
        options.sourceLocale ?? this.sourceLocale ?? libraryDefaultLocale
      ),
    };

    // resolve canonical locales
    files = files.map((f) => ({
      ...f,
      source: {
        ...f.source,
        locale: this.resolveCanonicalLocale(f.source.locale),
      },
    }));

    // Process files in batches and convert result to UploadFilesResponse
    const result = await _uploadSourceFiles(
      files,
      mergedOptions as RequiredUploadFilesOptions,
      this._getTranslationConfig()
    );

    return {
      uploadedFiles: result.data,
      count: result.count,
      message: `Successfully uploaded ${result.count} files in ${result.batchCount} batch(es)`,
    };
  }

  /**
   * Uploads translation files that correspond to previously uploaded source files.
   *
   * This method allows you to provide translated content for existing source files in your project.
   * Each translation must reference an existing source file and include the translated content
   * along with the target locale information. This is used when you have pre-existing translations
   * that you want to upload directly rather than generating them through the translation service.
   *
   * @param {Array<{source: FileUpload, translations: FileUpload[]}>} files - Array of file objects where:
   *   - `source`: Reference to the existing source file (contains IDs but no content)
   *   - `translations`: Array of translated files, each containing content, locale, and reference IDs
   * @param {UploadFilesOptions} options - Configuration options including source locale and upload settings
   * @returns {Promise<UploadFilesResponse>} Upload result containing translation IDs, status, and processing information
   */
  async uploadTranslations(
    files: {
      source: FileUpload; // reference only (no content)
      translations: FileUpload[]; // each has content + ids + locale
    }[],
    options: UploadFilesOptions
  ): Promise<UploadFilesResponse> {
    // Validation
    this._validateAuth('uploadTranslations');

    // Merge instance settings with options
    const mergedOptions: UploadFilesOptions = {
      ...options,
      sourceLocale: options.sourceLocale ?? this.sourceLocale,
    };

    // Require source locale
    if (!mergedOptions.sourceLocale) {
      const error = noSourceLocaleProvidedError('uploadTranslations');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Ensure all translation locales use canonical locales
    const targetFiles = files.map((f) => ({
      ...f,
      translations: f.translations.map((t) => ({
        ...t,
        locale: this.resolveCanonicalLocale(t.locale),
      })),
    }));

    // Process files in batches and convert result to UploadFilesResponse
    const result = await _uploadTranslations(
      targetFiles,
      mergedOptions as RequiredUploadFilesOptions,
      this._getTranslationConfig()
    );

    return {
      uploadedFiles: result.data,
      count: result.count,
      message: `Successfully uploaded ${result.count} files in ${result.batchCount} batch(es)`,
    };
  }
}

export const API_VERSION = _API_VERSION;
