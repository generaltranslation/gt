import React from 'react';

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
}: {
  children?: React.ReactNode;
  branch: string | number | boolean | undefined;
  [key: string]: React.ReactNode;
}): React.ReactNode {
  const branchKey = branch?.toString();
  // ignore data-* attributes
  if (typeof branch === 'string' && branch.startsWith('data-')) {
    branch = undefined;
  }
  const renderedBranch =
    branchKey && typeof branches[branchKey] !== 'undefined'
      ? branches[branchKey]
      : children;
  return renderedBranch;
}

/**
 * Equivalent to the `<Branch>` component, but used for auto insertion.
 */
function GtInternalBranch(props: {
  children?: React.ReactNode;
  branch: string | number | boolean | undefined;
  [key: string]: React.ReactNode;
}): React.ReactNode {
  return Branch(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Branch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';

export { GtInternalBranch, Branch };
