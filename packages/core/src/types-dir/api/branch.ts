export type BranchDataResult = {
  branches: {
    id: string;
    name: string; // Branch name.
  }[];
  defaultBranch: {
    id: string;
    name: string; // Branch name.
  } | null;
};
