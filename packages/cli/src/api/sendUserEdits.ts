import { logWarning } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { gt } from '../utils/gt.js';

// Single payload type used by CLI, includes optional localContent
export type UserEditDiff = {
  fileName: string;
  locale: string;
  diff: string; // unified diff string
  versionId?: string;
  fileId?: string; // GT file id if available
  localContent?: string;
};
export type SendUserEditsPayload = {
  projectId?: string;
  diffs: UserEditDiff[];
};

/**
 * Sends user edit diffs to the API for persistence/rule extraction.
 * This function is intentionally decoupled from the translate pipeline
 * so it can be called as an independent action.
 */
export async function sendUserEditDiffs(
  diffs: UserEditDiff[],
  settings: Settings
): Promise<void> {
  if (!diffs.length) return;

  const payload: SendUserEditsPayload = {
    projectId: settings.projectId,
    diffs,
  };
  await gt.submitUserEditDiffs(payload);
}
