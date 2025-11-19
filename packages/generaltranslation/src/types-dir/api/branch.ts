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
