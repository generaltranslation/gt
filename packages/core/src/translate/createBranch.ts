import type { CreateBranchResponse } from '@generaltranslation/api';

// Compatibility input: defaultBranch remains required on the published method,
// while the generated request makes it optional.
export type CreateBranchQuery = {
  branchName: string;
  defaultBranch: boolean;
};

export type CreateBranchResult = CreateBranchResponse;
