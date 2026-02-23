import { EnqueueFilesResult } from 'generaltranslation/types';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { runEnqueueWorkflow } from '../../workflows/enqueue.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { noFilesError, noVersionIdError } from '../../console/index.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';

/**
 * Enqueues translations for a given set of files
 * @param options - The options for the enqueue operation
 * @param settings - The settings for the enqueue operation
 * @returns {Promise<EnqueueFilesResult>} The enqueue result
 */
export async function handleEnqueue(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<EnqueueFilesResult> {
  if (!hasValidLocales(settings)) return exitSync(1);
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return exitSync(1);
  if (!settings._versionId) {
    return logErrorAndExit(noVersionIdError);
  }
  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }

  // Collect the data for all files we need to enqueue
  const { files } = await collectFiles(options, settings, library);

  return runEnqueueWorkflow({ files, options, settings });
}
