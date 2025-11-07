import type { FileReference } from 'generaltranslation/types';
import { WorkflowStep } from './Workflow.js';
import { createSpinner } from '../console/logging.js';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import { collectAndSendUserEditDiffs } from '../api/collectUserEditDiffs.js';

export class UserEditDiffsStep extends WorkflowStep<
  FileReference[],
  FileReference[]
> {
  private spinner = createSpinner('dots');
  private completed = false;

  constructor(private settings: Settings) {
    super();
  }

  async run(files: FileReference[]): Promise<FileReference[]> {
    this.spinner.start('Updating translations...');

    try {
      await collectAndSendUserEditDiffs(files, this.settings);
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
