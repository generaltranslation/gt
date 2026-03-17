import type { FileReference } from 'generaltranslation/types';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { collectAndSendUserEditDiffs } from '../../api/collectUserEditDiffs.js';

export class UserEditDiffsStep extends WorkflowStep<
  FileReference[],
  FileReference[]
> {
  private spinner = logger.createSpinner('dots');
  private succeeded = false;
  private failed = false;

  constructor(private settings: Settings) {
    super();
  }

  async run(files: FileReference[]): Promise<FileReference[]> {
    this.spinner.start('Updating translations...');

    try {
      await collectAndSendUserEditDiffs(files, this.settings);
      this.succeeded = true;
    } catch {
      // Non-fatal; keep going to enqueue
      this.failed = true;
    }

    return files;
  }

  async wait(): Promise<void> {
    if (this.succeeded) {
      this.spinner.stop(chalk.green('Updated translations'));
    } else if (this.failed) {
      this.spinner.stop(chalk.yellow('Could not update translations'));
    }
  }
}
