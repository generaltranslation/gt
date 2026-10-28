import { Settings } from '../types/index.js';
import { aggregateFiles } from '../formats/files/aggregateFiles.js';
import { collectAndSendUserEditDiffs } from './collectUserEditDiffs.js';
import { createClients } from '../utils/api.js';
import { BranchStep } from '../workflows/steps/BranchStep.js';
import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { branchResolutionError, noProjectIdError } from '../console/index.js';
import type { FileReference } from 'generaltranslation';
import chalk from 'chalk';
import { runPublishWorkflow } from '../workflows/publish.js';
import { readLockfile } from '../fs/config/downloadedVersions.js';
import { TEMPLATE_FILE_ID, TEMPLATE_FILE_NAME } from '../utils/constants.js';
import { shouldPublishGt } from '../utils/resolvePublish.js';

/**
 * Uploads current source files to obtain file references, then collects and sends
 * diffs for all locales based on last downloaded versions. Does not enqueue translations.
 * Returns false when every edit failed or the publish request failed.
 */
export async function saveLocalEdits(settings: Settings): Promise<boolean> {
  if (!settings.files) return true;

  // Collect current files from config
  const { files, publishMap } = await aggregateFiles(settings);
  const fileRefs = files.map((file) => ({
    fileName: file.fileName,
    fileFormat: file.fileFormat,
    fileId: file.fileId,
    versionId: file.versionId,
  }));

  // Include the GT JSON at its last downloaded version
  const gtJsonEntry = settings.files.placeholderPaths.gt
    ? readLockfile(settings).entryMap.get(TEMPLATE_FILE_ID)
    : undefined;
  if (gtJsonEntry) {
    fileRefs.push({
      fileName: TEMPLATE_FILE_NAME,
      fileFormat: 'GTJSON',
      fileId: TEMPLATE_FILE_ID,
      versionId: gtJsonEntry.versionId,
    });
    const gtPublishValue = shouldPublishGt(settings);
    if (gtPublishValue !== undefined) {
      publishMap.set(TEMPLATE_FILE_ID, gtPublishValue);
    }
  }
  if (!fileRefs.length) return true;

  const { project } = createClients(settings);
  if (!project) throw new Error(noProjectIdError);
  const branchStep = new BranchStep(project, settings);
  const branchResult = await branchStep.run();
  if (!branchResult) {
    return logErrorAndExit(branchResolutionError);
  }

  const uploads = fileRefs.map((file) => ({
    ...file,
    branchId: branchResult.currentBranch.id,
  })) satisfies FileReference[];

  const spinner = logger.createSpinner('dots');
  spinner.start('Saving local edits...');

  const { saved, failed } = await collectAndSendUserEditDiffs(
    uploads,
    settings
  );
  if (failed.length === 0) {
    spinner.stop(chalk.green('Local edits saved successfully'));
  } else if (saved.length === 0) {
    spinner.stop(chalk.red('Local edits could not be saved'));
  } else {
    spinner.stop(
      chalk.yellow(
        `Saved ${saved.length} of ${saved.length + failed.length} local edits`
      )
    );
  }

  if (saved.length === 0) return failed.length === 0;

  // Publish every configured file and every version an edit was saved to,
  // except versions with a failed edit, if publish config exists
  const versionKey = (file: { fileId: string; versionId: string }) =>
    `${file.fileId}:${file.versionId}`;
  const failedVersions = new Set(failed.map(versionKey));
  const versions = new Map(
    [...saved, ...fileRefs].map((file) => [versionKey(file), file])
  );
  return runPublishWorkflow(
    [...versions.values()].filter(
      (file) => !failedVersions.has(versionKey(file))
    ),
    publishMap,
    branchResult.currentBranch.id,
    settings
  );
}
