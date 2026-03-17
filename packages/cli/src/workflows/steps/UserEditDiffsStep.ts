import type { FileReference } from 'generaltranslation/types';
import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { collectAndSendUserEditDiffs } from '../../api/collectUserEditDiffs.js';

export type UserEditDiffsInput = {
  files: FileReference[];
  branchId: string;
};

export class UserEditDiffsStep extends WorkflowStep<
  UserEditDiffsInput,
  FileReference[]
> {
  private spinner = logger.createSpinner('dots');
  private completed = false;

  constructor(private settings: Settings) {
    super();
  }

  async run({ files, branchId }: UserEditDiffsInput): Promise<FileReference[]> {
    this.spinner.start('Updating translations...');

    try {
      await collectAndSendUserEditDiffs(files, this.settings, branchId);
      this.completed = true;
    } catch {
      // Non-fatal; keep going to enqueue
      this.completed = true;
    }

    return files;
  }

  async wait(): Promise<void> {
    if (this.completed) {
      this.spinner.stop(chalk.green('Updated translations'));
    }
  }
}
