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

/**
 * Type representing the constructor parameters for the GT class.
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
    super(params);
    // Read environment
    if (typeof process !== 'undefined') {
      this.apiKey ||= process.env?.GT_API_KEY;
      this.devApiKey ||= process.env?.GT_DEV_API_KEY;
      this.projectId ||= process.env?.GT_PROJECT_ID;
    }
    // Set API-specific properties (super already handled locale config)
    if (params.apiKey) this.apiKey = params.apiKey;
    if (params.devApiKey) this.devApiKey = params.devApiKey;
    if (params.projectId) this.projectId = params.projectId;
    if (params.baseUrl) this.baseUrl = params.baseUrl;
  }

  override setConfig(params: GTConstructorParams) {
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

  async queryBranchData(query: BranchQuery): Promise<BranchDataResult> {
    this._validateAuth('queryBranchData');
    return await _queryBranchData(query, this._getTranslationConfig());
  }

  async createBranch(query: CreateBranchQuery): Promise<CreateBranchResult> {
    this._validateAuth('createBranch');
    return await _createBranch(query, this._getTranslationConfig());
  }

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

  async createTag(options: CreateTagOptions): Promise<CreateTagResult> {
    this._validateAuth('createTag');
    return await _createTag(options, this._getTranslationConfig());
  }

  async publishFiles(files: PublishFileEntry[]): Promise<PublishFilesResult> {
    this._validateAuth('publishFiles');
    return await _publishFiles(files, this._getTranslationConfig());
  }

  async submitUserEditDiffs(
    payload: SubmitUserEditDiffsPayload
  ): Promise<void> {
    this._validateAuth('submitUserEditDiffs');
    const normalized: SubmitUserEditDiffsPayload = {
      ...payload,
      diffs: (payload.diffs || []).map((d) => ({
        ...d,
        locale: this.resolveCanonicalLocale(d.locale),
      })),
    };
    await _submitUserEditDiffs(normalized, this._getTranslationConfig());
  }

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

  async uploadTranslations(
    files: {
      source: FileUpload;
      translations: FileUpload[];
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
