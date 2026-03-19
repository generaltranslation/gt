import { Settings } from '../types/index.js';
import { aggregateFiles } from '../formats/files/aggregateFiles.js';
import { collectAndSendUserEditDiffs } from './collectUserEditDiffs.js';
import { gt } from '../utils/gt.js';
import { BranchStep } from '../workflows/steps/BranchStep.js';
import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';
import { runPublishWorkflow } from '../workflows/publish.js';

/**
 * Uploads current source files to obtain file references, then collects and sends
 * diffs for all locales based on last downloaded versions. Does not enqueue translations.
 */
export async function saveLocalEdits(settings: Settings): Promise<void> {
  if (!settings.files) return;

  // Collect current files from config
  const { files, publishMap } = await aggregateFiles(settings);
  if (!files.length) return;

  // run branch query to get branch id
  // Run the branch step
  const branchStep = new BranchStep(gt, settings);
  const branchResult = await branchStep.run();
  await branchStep.wait();
  if (!branchResult) {
    return logErrorAndExit('Failed to resolve git branch information.');
  }

  const uploads = files.map((file) => ({
    fileName: file.fileName,
    fileFormat: file.fileFormat,
    branchId: branchResult.currentBranch.id,
    fileId: file.fileId,
    versionId: file.versionId,
  })) satisfies FileReference[];

  const spinner = logger.createSpinner('dots');
  spinner.start('Saving local edits...');

  const hadDiffs = await collectAndSendUserEditDiffs(uploads, settings);
  spinner.stop(chalk.green('Local edits saved successfully'));

  // Publish files to CDN if diffs were detected and publish config exists
  if (hadDiffs) {
    await runPublishWorkflow(
      files,
      publishMap,
      branchResult.currentBranch.id,
      settings
    );
  }
}
