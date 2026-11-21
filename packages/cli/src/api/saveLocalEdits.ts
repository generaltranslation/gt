import { Settings } from '../types/index.js';
import { aggregateFiles } from '../formats/files/aggregateFiles.js';
import { collectAndSendUserEditDiffs } from './collectUserEditDiffs.js';
import { api } from '../utils/api.js';
import { BranchStep } from '../workflows/steps/BranchStep.js';
import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { branchResolutionError } from '../console/index.js';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';
import { runPublishWorkflow } from '../workflows/publish.js';
import { readLockfile } from '../fs/config/downloadedVersions.js';
import { TEMPLATE_FILE_ID, TEMPLATE_FILE_NAME } from '../utils/constants.js';
import { shouldPublishGt } from '../utils/resolvePublish.js';
import { getWarnings } from '../state/translateWarnings.js';

/**
 * Uploads current source files to obtain file references, then collects and sends
 * diffs for all locales based on last downloaded versions. Does not enqueue translations.
 */
export async function saveLocalEdits(settings: Settings): Promise<boolean> {
  if (!settings.files) return false;

  // Collect current files from config
  const { files, publishMap } = await aggregateFiles(settings);
  // Nothing to save and no template to include: resolve the branch only once
  // there is something to read from the lockfile, since resolving it can
  // create the branch on the remote.
  if (!files.length && !settings.files.placeholderPaths.gt) return false;

  // Resolve the branch before reading anything out of the lockfile: a v1
  // lockfile keeps every branch it has seen, and without a branch it is read
  // from whichever one is listed first.
  const branchStep = new BranchStep(api, settings);
  const branchResult = await branchStep.run();
  if (!branchResult) {
    return logErrorAndExit(branchResolutionError);
  }
  const branchId = branchResult.currentBranch.id;
  const branchSettings: Settings = { ...settings, _branchId: branchId };

  const fileRefs = files.map((file) => ({
    fileName: file.fileName,
    fileFormat: file.fileFormat,
    fileId: file.fileId,
    versionId: file.versionId,
  }));

  // Include the GT JSON at its last downloaded version
  const gtJsonEntry = settings.files.placeholderPaths.gt
    ? readLockfile(branchSettings).entryMap.get(TEMPLATE_FILE_ID)
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
  if (!fileRefs.length) return false;

  const uploads = fileRefs.map((file) => ({
    ...file,
    branchId,
  })) satisfies FileReference[];

  const spinner = logger.createSpinner('dots');
  spinner.start('Saving local edits...');

  const hadDiffs = await collectAndSendUserEditDiffs(uploads, settings);
  // A locale whose baseline could not be retrieved is reported by the
  // collector, so a run that saved something but skipped something else says
  // so rather than claiming an unqualified success.
  const skipped = getWarnings().filter(
    (warning) => warning.category === 'skipped_file'
  ).length;
  spinner.stop(
    !hadDiffs
      ? chalk.yellow('No local edits were saved')
      : skipped > 0
        ? chalk.yellow(
            `Local edits saved, ${skipped} could not be saved (see the warnings above)`
          )
        : chalk.green('Local edits saved successfully')
  );

  // Publish files to CDN if diffs were detected and publish config exists
  if (hadDiffs) {
    await runPublishWorkflow(fileRefs, publishMap, branchId, settings);
  }

  return hadDiffs;
}
