import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

export async function getCurrentBranch(remoteName: string): Promise<{
  branchName: string;
  defaultBranch: boolean;
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
    const branchName = stdout.trim();

    // Get the default branch (usually main or master)
    const { stdout: defaultBranchRef } = await execAsync(
      'git',
      ['symbolic-ref', `refs/remotes/${remoteName}/HEAD`],
      { encoding: 'utf8', windowsHide: true }
    );
    const defaultBranchName = defaultBranchRef
      .trim()
      .replace(`refs/remotes/${remoteName}/`, '');
    const defaultBranch = branchName === defaultBranchName;

    return { branchName, defaultBranch };
  } catch {
    return null;
  }
}

const MAX_BRANCHES = 10;

export async function getIncomingBranches(
  remoteName: string
): Promise<string[]> {
  try {
    // Get merge commits in the current branch's history
    // This will show branches that were merged, including remote PR merges
    const { stdout: log } = await execAsync(
      'git log --merges --first-parent --format="%s" --no-abbrev-commit',
      {
        encoding: 'utf8',
      }
    );

    const branches: string[] = [];
    const seen = new Set<string>();

    // Parse commit messages like "Merge pull request #123 from owner/branch_name"
    // or "Merge branch 'branch_name' into main"
    const lines = log
      .trim()
      .split('\n')
      .filter((line) => line);

    for (const line of lines) {
      if (branches.length >= MAX_BRANCHES) break;

      // Match GitHub PR merge format: "Merge pull request #123 from owner/branch_name"
      let match = line.match(/Merge pull request #\d+ from [^/]+\/(.+)/i);
      if (match && match[1]) {
        const branchName = match[1].trim();
        if (!seen.has(branchName)) {
          seen.add(branchName);
          branches.push(branchName);
        }
        continue;
      }

      // Match standard merge format: "Merge branch 'branch_name'"
      match = line.match(/Merge branch '([^']+)'/i);
      if (match && match[1]) {
        const branchName = match[1].trim();
        if (!seen.has(branchName)) {
          seen.add(branchName);
          branches.push(branchName);
        }
      }
    }

    return branches;
  } catch {
    // If log fails or no merges found, return empty array
    return [];
  }
}

export async function getCheckedOutBranches(
  remoteName: string
): Promise<string[]> {
  try {
    const currentBranch = await getCurrentBranch(remoteName);

    if (!currentBranch) {
      return [];
    }

    // Get branches that the current branch was checked out from
    const { stdout: reflog } = await execAsync('git reflog --format="%gs"', {
      encoding: 'utf8',
    });

    const branches: string[] = [];
    const seen = new Set<string>();

    // Parse reflog entries like "checkout: moving from branch1 to branch2"
    // We want the "from" branch when we checked out TO the current branch
    const lines = reflog
      .trim()
      .split('\n')
      .filter((line) => line);

    for (const line of lines) {
      if (branches.length >= MAX_BRANCHES) break;

      const match = line.match(/checkout: moving from (.+) to (.+)/i);
      if (match && match[1] && match[2]) {
        const fromBranch = match[1].trim();
        const toBranch = match[2].trim();

        // If we checked out TO the current branch, record the FROM branch
        if (toBranch === currentBranch.branchName && !seen.has(fromBranch)) {
          seen.add(fromBranch);
          branches.push(fromBranch);
        }
      }
    }

    return branches;
  } catch {
    // If reflog fails, return empty array
    return [];
  }
}
