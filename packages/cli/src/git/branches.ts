import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);
const MAX_BRANCHES = 5;

export async function getCurrentBranch(remoteName: string): Promise<{
  currentBranchName: string;
  defaultBranch: boolean;
  defaultBranchName: string;
} | null> {
  try {
    const { stdout } = await execAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        encoding: 'utf8',
        windowsHide: true,
      }
    );
    const currentBranchName = stdout.trim();

    // Get the default branch (usually main or master)
    const { stdout: defaultBranchRef } = await execAsync(
      'git',
      ['symbolic-ref', `refs/remotes/${remoteName}/HEAD`],
      { encoding: 'utf8', windowsHide: true }
    );
    const defaultBranchName = defaultBranchRef
      .trim()
      .replace(`refs/remotes/${remoteName}/`, '');
    const defaultBranch = currentBranchName === defaultBranchName;

    return { currentBranchName, defaultBranch, defaultBranchName };
  } catch {
    return null;
  }
}

export async function getIncomingBranches(
  remoteName: string
): Promise<string[]> {
  try {
    // Get merge commits into the current branch
    const { stdout } = await execAsync(
      'git',
      [
        'log',
        '--merges',
        '--first-parent',
        '--pretty=format:%s',
        `-${MAX_BRANCHES}`,
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      }
    );

    if (!stdout.trim()) {
      return [];
    }

    const branches: string[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      // Parse merge commit messages:
      // - "Merge branch 'feature-name'" or "Merge branch 'feature-name' into main"
      // - "Merge pull request #123 from user/branch-name"
      const branchMatch = line.match(/Merge branch '([^']+)'/);
      const prMatch = line.match(/Merge pull request #\d+ from [^/]+\/(.+)/);

      if (branchMatch && branchMatch[1]) {
        branches.push(branchMatch[1]);
      } else if (prMatch && prMatch[1]) {
        branches.push(prMatch[1]);
      }
    }

    return branches.slice(0, MAX_BRANCHES);
  } catch {
    // If log fails or no merges found, return empty array
    return [];
  }
}

export async function getCheckedOutBranches(
  remoteName: string
): Promise<string[]> {
  try {
    // Get current branch
    const currentBranchResult = await getCurrentBranch(remoteName);
    if (!currentBranchResult) {
      return [];
    }

    // If we're already on the default branch, return empty
    if (currentBranchResult.defaultBranch) {
      return [];
    }

    // Check if there's a merge-base (common ancestor) between default branch and current
    // This means the branch was at some point checked out from the default branch
    try {
      await execAsync(
        'git',
        ['merge-base', currentBranchResult.defaultBranchName, 'HEAD'],
        { encoding: 'utf8', windowsHide: true }
      );
      // If merge-base exists, the branch shares history with default branch
      return [currentBranchResult.defaultBranchName];
    } catch {
      // No common ancestor found
      return [];
    }
  } catch {
    return [];
  }
}
