import { GT } from 'generaltranslation';
import {
  UnuploadedFile,
  UploadedFile,
  toFileRefs,
  EnqueueFilesResult,
} from 'generaltranslation/types';
import { Settings } from '../types/index.js';

/**
 * Result type for setup operations
 */
export type SetupResult = { success: true } | { success: false; error: string };

/**
 * Options for enqueueing files
 */
export type EnqueueOptions = {
  force?: boolean;
};

/**
 * Service: Handles file upload phase
 */
export class FileUploadService {
  constructor(
    private gt: GT,
    private config: Settings
  ) {}

  async upload(files: UnuploadedFile[]): Promise<UploadedFile[]> {
    if (!this.config.defaultLocale) {
      throw new Error(
        'settings.defaultLocale is required to upload source files'
      );
    }

    const response = await this.gt.uploadSourceFiles(
      files.map((f) => ({ source: f })),
      {
        sourceLocale: this.config.defaultLocale,
        modelProvider: this.config.modelProvider,
      }
    );

    // Merge server references back into file entities
    return response.uploadedFiles.map((ref, idx) => ({
      ...files[idx],
      branchId: ref.branchId,
      fileId: ref.fileId,
      versionId: ref.versionId,
    }));
  }
}

/**
 * Service: Handles project setup phase
 */
export class ProjectSetupService {
  constructor(
    private gt: GT,
    private config: Settings
  ) {}

  async setup(files: UploadedFile[], timeoutMs: number): Promise<SetupResult> {
    const result = await this.gt.setupProject(toFileRefs(files), {
      locales: this.config.locales,
    });

    if (result.status === 'completed') {
      return { success: true };
    }

    if (result.status === 'queued') {
      return await this.pollSetupStatus(result.setupJobId, timeoutMs);
    }

    return { success: false, error: 'Unknown setup status' };
  }

  private async pollSetupStatus(
    jobId: string,
    timeoutMs: number
  ): Promise<SetupResult> {
    const start = Date.now();
    const pollInterval = 2000;

    while (Date.now() - start < timeoutMs) {
      const status = await this.gt.checkSetupStatus(jobId);

      if (status.status === 'completed') {
        return { success: true };
      }
      if (status.status === 'failed') {
        return {
          success: false,
          error: status.error?.message || 'Unknown error',
        };
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return { success: false, error: 'Setup timed out' };
  }
}

/**
 * Service: Handles translation enqueueing
 */
export class TranslationEnqueueService {
  constructor(
    private gt: GT,
    private config: Settings
  ) {}

  async enqueue(
    files: UploadedFile[],
    options: EnqueueOptions
  ): Promise<EnqueueFilesResult> {
    if (!this.config.defaultLocale) {
      throw new Error('settings.defaultLocale is required to enqueue files');
    }

    return await this.gt.enqueueFiles(toFileRefs(files), {
      sourceLocale: this.config.defaultLocale,
      targetLocales: this.config.locales,
      publish: this.config.publish,
      requireApproval: this.config.stageTranslations,
      modelProvider: this.config.modelProvider,
      force: options.force,
    });
  }
}
