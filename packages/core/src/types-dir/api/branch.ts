// Compatibility response: the published type preserves a nullable default
// branch while the generated intersection currently loses that nullability.
export type BranchDataResult = {
  branches: {
    id: string;
    name: string; // branch name
  }[];
  defaultBranch: {
    id: string;
    name: string; // branch name
  } | null;
};
