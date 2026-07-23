import type { CreateTagResult } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

export class TagStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: GT,
    private settings: Settings,
    private userProvided: boolean
  ) {}

  async run(files: FileReference[]): Promise<CreateTagResult> {
    if (this.userProvided) {
      this.spinner.start('Creating translation tag...');
    }

    try {
      const result = await this.gt.createTag({
        tagId: this.settings.tag!,
        files: files.map((f) => ({
          fileId: f.fileId,
          versionId: f.versionId,
          branchId: f.branchId,
        })),
        message: this.settings.tagMessage,
      });
      if (this.userProvided) {
        this.spinner.stop(
          chalk.green(`Tagged as ${chalk.bold(result.tag.tagId)}`)
        );
      }
      return result;
    } catch (error) {
      if (this.userProvided) {
        this.spinner.stop(chalk.yellow('Failed to create translation tag'));
      }
      throw error;
    }
  }
}
