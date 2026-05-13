import type { ReactNode } from 'react';

type BranchProps = {
  children?: ReactNode;
  branch: string | number | boolean | undefined;
  [key: string]: ReactNode;
};

/**
 * The `<Branch>` component dynamically renders a specified branch of content
 * or a fallback child component. It allows for flexible content switching
 * based on the `branch` prop.
 *
 * This is the i18n-context version — does not use React Context.
 */
function Branch({
  children,
  branch,
  ...branches
}: BranchProps): ReactNode {
  const branchKey = branch?.toString();
  if (branchKey?.startsWith('data-')) return children;
  return branchKey && typeof branches[branchKey] !== 'undefined'
    ? branches[branchKey]
    : children;
}

/**
 * Equivalent to the `<Branch>` component, but used for auto insertion.
 */
function GtInternalBranch(props: BranchProps): ReactNode {
  return Branch(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Branch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';

export { GtInternalBranch, Branch };
