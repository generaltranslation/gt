import { Settings } from '../types/index.js';
import { gt } from '../utils/gt.js';

export type UserEditDiff = {
  fileName: string;
  locale: string;
  diff: string; // unified diff string
  versionId?: string; // optional for server-side correlation
  fileId?: string; // GT file id if available
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

  // Prefer SDK method if present; do not hit HTTP directly from CLI
  const payload: SendUserEditsPayload = {
    projectId: settings.projectId,
    diffs,
  };
  // Prefer SDK method if available on current GT version
  const hasSubmitMethod =
    typeof (gt as unknown as Record<string, unknown>)['submitUserEditDiffs'] ===
    'function';
  if (hasSubmitMethod) {
    try {
      await (
        gt as unknown as {
          submitUserEditDiffs: (
            payload: SendUserEditsPayload
          ) => Promise<void>;
        }
      ).submitUserEditDiffs(payload);
    } catch {
      // Non-fatal and intentionally silent
    }
  }
}
