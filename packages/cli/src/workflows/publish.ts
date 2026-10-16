import { createDiagnosticMessage } from 'generaltranslation/internal';
import { Settings } from '../types/index.js';
import { PublishStep, type PublishFailure } from './steps/PublishStep.js';
import { api } from '../utils/api.js';
import { hasPublishConfig } from '../utils/resolvePublish.js';
import { logger } from '../console/logger.js';

function publishFailedError(
  failures: PublishFailure[],
  dashboardUrl: string
): string {
  const files = failures.length === 1 ? '1 file' : `${failures.length} files`;
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    // The workflow both publishes and unpublishes files.
    whatHappened: `CDN updates failed for ${files}`,
    why: 'apps that load translations from the CDN keep getting the previous state of these files',
    fix: `Check that the CDN is enabled in the project's settings in the dashboard ${dashboardUrl}, then run the command again`,
    details: failures.map(({ fileName, reason }) => `${fileName} (${reason})`),
  });
}

/**
 * Publishes files to the CDN if publish config exists and the publishMap is non-empty.
 * Shared by translate, upload, and save-local commands. A failed publish sets
 * a failing exit code, so a deploy that runs the command stops instead of
 * shipping without its translations.
 */
export async function runPublishWorkflow(
  files: { fileId: string; versionId: string; fileName: string }[],
  publishMap: Map<string, boolean>,
  branchId: string,
  settings: Settings
): Promise<void> {
  if (publishMap.size === 0 || !hasPublishConfig(settings)) return;

  const allFileRefs = files
    .filter((file) => publishMap.has(file.fileId))
    .map((file) => ({
      fileId: file.fileId,
      versionId: file.versionId,
      branchId,
      publish: publishMap.get(file.fileId)!,
      fileName: file.fileName,
    }));
  if (allFileRefs.length === 0) return;

  let failures: PublishFailure[];
  try {
    failures = await new PublishStep(api).run(allFileRefs);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures = allFileRefs.map(({ fileName }) => ({ fileName, reason }));
  }
  if (failures.length === 0) return;

  logger.error(publishFailedError(failures, settings.dashboardUrl));
  process.exitCode = 1;
}
