export type BranchData = {
  currentBranch: {
    id: string;
    name: string; // branch name
  };
  incomingBranch: {
    id: string;
    name: string; // branch name
  } | null;
  checkedOutBranch: {
    id: string;
    name: string; // branch name
  } | null;
};
