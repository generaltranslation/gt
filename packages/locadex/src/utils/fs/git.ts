import { execSync } from 'child_process';
import { unlinkSync } from 'fs';
import { logger } from '../../logging/logger.js';

/**
 * Deletes any newly created (untracked) files, except those in ignoreDirectories.
 * @param ignoreDirectories - Array of directory names to ignore (relative to repo root).
 */
export function deleteAddedFiles(ignoreDirectories: string[]) {
  logger.debugMessage(
    `Deleting untracked files, ignoring directories: ${ignoreDirectories.join(
      ', '
    )}`
  );
  // Get list of untracked files from git
  const output = execSync('git status --porcelain', { encoding: 'utf-8' });
  const untrackedFiles = output
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim())
    .filter((file) => file.length > 0);

  // Filter out files in ignored directories
  const filesToDelete = untrackedFiles.filter((file) => {
    return !ignoreDirectories.some(
      (dir) => file === dir || file.startsWith(dir + '/')
    );
  });

  // Delete each file
  for (const file of filesToDelete) {
    try {
      unlinkSync(file);
    } catch (err) {
      // Optionally log or handle errors
    }
  }
  logger.verboseMessage(`Deleted ${filesToDelete.length} untracked files`);
}
