import {
  getPluralForm,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';

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
  branches: Record<string, unknown>
) {
  let branchName = '';
  let branch = null;
  if (typeof n === 'number' && !branch && branches) {
    const pluralForms = Object.keys(branches).filter(isAcceptedPluralForm);
    branchName = getPluralForm(n, pluralForms, locales);
  }
  if (branchName && !branch) branch = branches[branchName];
  return branch;
}
