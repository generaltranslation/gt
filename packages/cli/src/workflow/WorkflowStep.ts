import { GT } from 'generaltranslation';
import type {
  NotYetUploadedFile,
  UploadedFile,
  EnqueueFilesResult,
  FileUploadRef,
} from 'generaltranslation/types';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import { createSpinner } from '../console/logging.js';

export abstract class WorkflowStep<TInput = void, TOutput = void> {
  abstract run(input: TInput): Promise<TOutput>;

  abstract wait(): Promise<void>;
}

/**
 * Convert UploadedFile[] to FileUploadRef[] for API calls
 */
function toFileRefs(files: UploadedFile[]): FileUploadRef[] {
  return files.map((f) => ({
    branchId: f.branchId,
    fileId: f.fileId,
    versionId: f.versionId,
    fileName: f.fileName,
    fileFormat: f.fileFormat,
    dataFormat: f.dataFormat,
    locale: f.locale,
  }));
}

export class UploadStep extends WorkflowStep<
  NotYetUploadedFile[],
  UploadedFile[]
> {
  private spinner = createSpinner('dots');
  private result: UploadedFile[] | null = null;

  constructor(
    private gt: GT,
    private settings: Settings
  ) {
    super();
  }

  async run(files: NotYetUploadedFile[]): Promise<UploadedFile[]> {
    this.spinner.start(
      `Uploading ${files.length} file${files.length !== 1 ? 's' : ''} to General Translation API...`
    );

    if (!this.settings.defaultLocale) {
      throw new Error(
        'settings.defaultLocale is required to upload source files'
      );
    }

    const response = await this.gt.uploadSourceFiles(
      files.map((f) => ({ source: f })),
      {
        sourceLocale: this.settings.defaultLocale,
        modelProvider: this.settings.modelProvider,
      }
    );

    // Merge server references back into file entities
    this.result = response.uploadedFiles.map((ref, idx) => ({
      ...files[idx],
      branchId: ref.branchId,
      fileId: ref.fileId,
      versionId: ref.versionId,
    }));

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.result) {
      this.spinner.stop(chalk.green('Files uploaded successfully'));
    }
  }
}

export class SetupStep extends WorkflowStep<UploadedFile[], UploadedFile[]> {
  private spinner = createSpinner('dots');
  private setupJobId: string | null = null;
  private files: UploadedFile[] | null = null;
  private completed = false;

  constructor(
    private gt: GT,
    private settings: Settings,
    private timeoutMs: number
  ) {
    super();
  }

  async run(files: UploadedFile[]): Promise<UploadedFile[]> {
    this.files = files;
    this.spinner.start('Setting up project...');

    const result = await this.gt.setupProject(toFileRefs(files), {
      locales: this.settings.locales,
    });

    if (result.status === 'completed') {
      this.completed = true;
      return files;
    }

    if (result.status === 'queued') {
      this.setupJobId = result.setupJobId;
      return files;
    }

    // Unknown status
    this.completed = true;
    return files;
  }

  async wait(): Promise<void> {
    if (this.completed) {
      this.spinner.stop(chalk.green('Setup successfully completed'));
      return;
    }

    if (!this.setupJobId) {
      this.spinner.stop(
        chalk.yellow('Setup status unknown — proceeding without setup')
      );
      return;
    }

    // Poll for completion
    const start = Date.now();
    const pollInterval = 2000;

    while (Date.now() - start < this.timeoutMs) {
      const status = await this.gt.checkSetupStatus(this.setupJobId);

      if (status.status === 'completed') {
        this.spinner.stop(chalk.green('Setup successfully completed'));
        return;
      }

      if (status.status === 'failed') {
        this.spinner.stop(
          chalk.yellow(
            `Setup failed: ${status.error?.message || 'Unknown error'} — proceeding without setup`
          )
        );
        return;
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Timeout
    this.spinner.stop(
      chalk.yellow('Setup timed out — proceeding without setup')
    );
  }
}

export class EnqueueStep extends WorkflowStep<
  UploadedFile[],
  EnqueueFilesResult
> {
  private spinner = createSpinner('dots');
  private result: EnqueueFilesResult | null = null;

  constructor(
    private gt: GT,
    private settings: Settings,
    private force?: boolean
  ) {
    super();
  }

  async run(files: UploadedFile[]): Promise<EnqueueFilesResult> {
    this.spinner.start('Enqueuing translations...');

    if (!this.settings.defaultLocale) {
      throw new Error('settings.defaultLocale is required to enqueue files');
    }

    this.result = await this.gt.enqueueFiles(toFileRefs(files), {
      sourceLocale: this.settings.defaultLocale,
      targetLocales: this.settings.locales,
      publish: this.settings.publish,
      requireApproval: this.settings.stageTranslations,
      modelProvider: this.settings.modelProvider,
      force: this.force,
    });

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.result) {
      this.spinner.stop(
        chalk.green('Files for translation uploaded successfully')
      );
    }
  }
}
