import type { CreateTagResult } from 'generaltranslation/types';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

export class TagStep extends WorkflowStep<FileReference[], CreateTagResult> {
  private spinner = logger.createSpinner('dots');
  private result: CreateTagResult | null = null;

  constructor(
    private gt: GT,
    private settings: Settings,
    private userProvided: boolean
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<CreateTagResult> {
    if (this.userProvided) {
      this.spinner.start('Creating translation tag...');
    }

    this.result = await this.gt.createTag({
      tagId: this.settings.tag!,
      files: files.map((f) => ({
        fileId: f.fileId,
        versionId: f.versionId,
        branchId: f.branchId,
      })),
      message: this.settings.tagMessage,
    });

    return this.result;
  }

  async wait(): Promise<void> {
    if (this.result && this.userProvided) {
      this.spinner.stop(
        chalk.green(`Tagged as ${chalk.bold(this.result.tag.tagId)}`)
      );
    }
  }
}
