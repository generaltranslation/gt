import {
  createDiagnosticMessage,
  type DiagnosticSeverity,
} from 'generaltranslation/internal';
import { Settings } from '../types/index.js';
import { PublishStep, type PublishFailure } from './steps/PublishStep.js';
import { api } from '../utils/api.js';
import { hasPublishConfig } from '../utils/resolvePublish.js';
import { logger } from '../console/logger.js';

function publishFailedDiagnostic(
  failures: PublishFailure[],
  dashboardUrl: string,
  severity: DiagnosticSeverity
): string {
  const files = failures.length === 1 ? '1 file' : `${failures.length} files`;
  return createDiagnosticMessage({
    source: 'gt',
    severity,
    whatHappened: `CDN updates failed for ${files}`,
    fix: `Check that the CDN is enabled in the project's settings in the dashboard ${dashboardUrl}, then run the command again`,
    details: failures.map(({ fileName, reason }) => `${fileName} (${reason})`),
  });
}

/**
 * Publishes files to the CDN if publish config exists and the publishMap is non-empty.
 * Shared by translate, upload, and save-local commands. A failed publish sets
 * a failing exit code, so a deploy that runs the command stops instead of
 * shipping without its translations. A failed unpublish only warns.
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

  const failures = await new PublishStep(api).run(allFileRefs);
  if (failures.length === 0) return;

  // Only a failed publish fails the command: a project without the CDN also
  // rejects unpublishing, which `publish: false` sends.
  if (failures.some((failure) => failure.publish)) {
    logger.error(
      publishFailedDiagnostic(failures, settings.dashboardUrl, 'Error')
    );
    process.exitCode = 1;
  } else {
    logger.warn(
      publishFailedDiagnostic(failures, settings.dashboardUrl, 'Warning')
    );
  }
}
