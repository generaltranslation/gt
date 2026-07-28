import type { FileReference } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { collectAndSendUserEditDiffs } from '../../api/collectUserEditDiffs.js';

export class UserEditDiffsStep {
  private spinner = logger.createSpinner('dots');

  constructor(private settings: Settings) {}

  async run(files: FileReference[]): Promise<FileReference[]> {
    this.spinner.start('Updating translations...');

    try {
      await collectAndSendUserEditDiffs(files, this.settings);
      this.spinner.stop(chalk.green('Updated translations'));
    } catch {
      // Non-fatal; keep going to enqueue
      this.spinner.stop(chalk.yellow('Could not update translations'));
    }

    return files;
  }
}
