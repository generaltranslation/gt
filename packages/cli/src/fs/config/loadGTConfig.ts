import fs from 'node:fs';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { logErrorAndExit } from '../../console/logging.js';

/**
 * Reads a user-selected GT configuration and fails closed when its JSON is
 * malformed.
 *
 * GT configuration controls catalog inputs and outputs, so silently replacing
 * an unreadable file with an empty object could make a command operate with
 * unrelated defaults. This strict loader is intentionally separate from the
 * tolerant generic JSON loader used for optional files such as `tsconfig.json`.
 *
 * @param filepath - Absolute or working-directory-relative GT config path.
 * @returns The parsed GT configuration object.
 */
export function loadGTConfig(filepath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as Record<
      string,
      unknown
    >;
  } catch (error) {
    return logErrorAndExit(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `Could not parse GT configuration at "${filepath}"`,
        why: 'the file is not valid JSON',
        fix: 'Fix the JSON syntax before running the command again',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
}
