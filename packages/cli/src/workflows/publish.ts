import { Settings } from '../types/index.js';
import { PublishStep } from './steps/PublishStep.js';
import { api } from '../utils/api.js';
import { hasPublishConfig } from '../utils/resolvePublish.js';
import { logger } from '../console/logger.js';

/**
 * Publishes files to the CDN if publish config exists and the publishMap is non-empty.
 * Shared by translate, upload, and save-local commands.
 * Returns false when publishing failed as a whole.
 */
export async function runPublishWorkflow(
  files: { fileId: string; versionId: string; fileName: string }[],
  publishMap: Map<string, boolean>,
  branchId: string,
  settings: Settings
): Promise<boolean> {
  if (publishMap.size === 0 || !hasPublishConfig(settings)) return true;

  try {
    const allFileRefs = files
      .filter((file) => publishMap.has(file.fileId))
      .map((file) => ({
        fileId: file.fileId,
        versionId: file.versionId,
        branchId,
        publish: publishMap.get(file.fileId)!,
        fileName: file.fileName,
      }));
    if (allFileRefs.length === 0) return true;
    const publishStep = new PublishStep(api);
    return await publishStep.run(allFileRefs);
  } catch (error) {
    logger.warn(
      `Failed to publish files: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
