import type { FileTranslationJob } from '../../workflows/steps/EnqueueStep.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { runEnqueueWorkflow } from '../../workflows/enqueue.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { noFilesError } from '../../console/index.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';
import {
  exitSync,
  logCollectedFiles,
  logErrorAndExit,
} from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import { warnManualReviewSetup } from '../../translation/reviewSetupWarning.js';

/**
 * Enqueues translations for a given set of files
 * @param options - The options for the enqueue operation
 * @param settings - The settings for the enqueue operation
 * @returns {Promise<FileTranslationJob[]>} The enqueued file translation jobs
 */
export async function handleEnqueue(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<FileTranslationJob[]> {
  if (!hasValidLocales(settings, { forApi: !options.dryRun }))
    return exitSync(1);
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return exitSync(1);
  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }

  // Collect the data for all files we need to enqueue
  const { files, reactComponents, inlineLibrary } = await collectFiles(
    options,
    settings,
    library
  );

  // Point at dashboard review setup when uploading review-gated content
  await warnManualReviewSetup(settings, files);

  // Dry run
  if (options.dryRun) {
    logger.success(`Dry run: No translations were enqueued.`);
    logCollectedFiles(files, reactComponents, inlineLibrary);
    return [];
  }

  return runEnqueueWorkflow({ files, options, settings, inlineLibrary });
}
