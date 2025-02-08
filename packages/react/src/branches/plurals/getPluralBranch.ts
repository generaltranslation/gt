import { getPluralForm } from 'generaltranslation/internal';

/**
 * Main function to get the appropriate branch based on the provided number and branches.
 *
 * @param {number} n - The number to determine the branch for.
 * @param {any} branches - The object containing possible branches.
 * @returns {any} The determined branch.
 */
export default function getPluralBranch(
  n: number,
  locales: string[],
  branches: Record<string, any>
) {
  let branchName = '';
  let branch = null;
  if (typeof n === 'number' && !branch && branches)
    branchName = getPluralForm(n, Object.keys(branches) as any, locales);
  if (branchName && !branch) branch = branches[branchName];
  return branch;
}
