import fs from 'node:fs';
import path from 'node:path';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { sendUserEditDiffs } from '../../api/sendUserEdits.js';
import { Settings } from '../../types/index.js';
import { logErrorAndExit, logMessage } from '../../console/logging.js';

export type SendDiffsFlags = {
  fileName: string; // logical source file path used by GT
  locale: string;
  old: string; // path to downloaded/original content
  next: string; // path to current/local content
};

export async function handleSendDiffs(
  flags: SendDiffsFlags,
  settings: Settings
) {
  const { fileName, locale, old, next } = flags;

  if (!fs.existsSync(old)) {
    logErrorAndExit(`Old/original file not found: ${old}`);
  }
  if (!fs.existsSync(next)) {
    logErrorAndExit(`New/local file not found: ${next}`);
  }

  let diff: string;
  try {
    diff = await getGitUnifiedDiff(old, next);
  } catch (e) {
    logErrorAndExit(
      'Git is required to compute diffs. Please install Git and ensure it is available on your PATH.'
    );
    return; // unreachable
  }

  if (!diff || diff.trim().length === 0) {
    logMessage('No differences detected — nothing to send.');
    return;
  }

  await sendUserEditDiffs(
    [
      {
        fileName,
        locale,
        diff,
      },
    ],
    settings
  );
}
