import {
  getPluralForm,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';

/**
 * Selects the appropriate plural branch for `n` from the provided branches,
 * following the locales' plural rules.
 */
export function getPluralBranch<T>(
  n: number,
  locales: string[],
  branches: Record<string, T>
): T | null {
  let branchName = '';
  let branch: T | null = null;
  if (typeof n === 'number' && !branch && branches) {
    const pluralForms = Object.keys(branches).filter(isAcceptedPluralForm);
    branchName = getPluralForm(n, pluralForms, locales);
  }
  if (branchName && !branch) branch = branches[branchName];
  return branch;
}
