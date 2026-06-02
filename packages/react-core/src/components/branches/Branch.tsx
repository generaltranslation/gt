import type { ReactNode } from 'react';

type BranchProps = {
  children?: ReactNode;
  branch?: string | number | boolean;
  _locale?: string;
  _enableI18n?: boolean;
  [key: string]: ReactNode;
};

// ===== Component ===== //

/**
 * External-store version of the `<Branch>` component.
 */
function GtInternalBranch({
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

function Branch(props: BranchProps): React.JSX.Element {
  return <GtInternalBranch {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';

// ===== Exports ===== //

export { GtInternalBranch, Branch };
