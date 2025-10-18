import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Returns a unified diff using the system's git, comparing two paths even if not in a repo.
 * Uses `git diff --no-index` so neither path needs to be tracked by git.
 *
 * Exit codes: 0 (no changes), 1 (changes), >1 (error). We treat 0/1 as success.
 * Throws if git is unavailable or another error occurs.
 */
export async function getGitUnifiedDiff(
  oldPath: string,
  newPath: string
): Promise<string> {
  const res = await execFileAsync(
    'git',
    [
      'diff',
      '--no-index',
      '--text',
      '--unified=3',
      '--no-color',
      '--',
      oldPath,
      newPath,
    ],
    {
      windowsHide: true,
    }
  ).catch((error: any) => {
    // Exit code 1 means differences found; stdout contains the diff
    if (error && error.code === 1 && typeof error.stdout === 'string') {
      return { stdout: error.stdout as string };
    }
    throw error;
  });
  // When there are no changes, stdout is empty string and exit code 0
  return res.stdout || '';
}
