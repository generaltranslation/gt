import type { ReactNode } from 'react';

type BranchProps = {
  children?: ReactNode;
  branch?: string | number | boolean;
  _locale?: string;
  _enableI18n?: boolean;
  [key: string]: ReactNode;
};

function computeBranch({
  children,
  branch,
  _locale,
  _enableI18n,
  ...branches
}: BranchProps): ReactNode {
  void _locale;
  void _enableI18n;

  let branchKey = branch?.toString();
  if (typeof branchKey === 'string' && branchKey.startsWith('data-')) {
    branchKey = undefined;
  }
  return branchKey && typeof branches[branchKey] !== 'undefined'
    ? branches[branchKey]
    : children;
}

export { computeBranch };
export type { BranchProps };
