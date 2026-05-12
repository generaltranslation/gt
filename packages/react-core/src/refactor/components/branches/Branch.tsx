import type { ReactNode } from "react";

// ===== Component ===== //

/**
 * External-store version of the `<Branch>` component.
 */
function Branch({
  children,
  branch,
  ...branches
}: {
  children?: ReactNode;
  branch?: string | number | boolean;
  [key: string]: ReactNode;
}): ReactNode {
  let branchKey = branch?.toString();
  if (typeof branchKey === "string" && branchKey.startsWith("data-")) {
    branchKey = undefined;
  }
  return branchKey && typeof branches[branchKey] !== "undefined"
    ? branches[branchKey]
    : children;
}

function GtInternalBranch(props: {
  children?: ReactNode;
  branch?: string | number | boolean;
  [key: string]: ReactNode;
}): ReactNode {
  return Branch(props);
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = "branch";
GtInternalBranch._gtt = "branch-automatic";

// ===== Exports ===== //

export { GtInternalBranch, Branch };
