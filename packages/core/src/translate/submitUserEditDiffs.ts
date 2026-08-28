// Compatibility input: published diffs require fileName and branchId, while
// the generated request omits fileName and permits a missing branchId.
export type SubmitUserEditDiff = {
  fileName: string;
  locale: string;
  diff: string;
  branchId: string;
  versionId: string;
  fileId: string;
  localContent: string;
};

export type SubmitUserEditDiffsPayload = {
  diffs: SubmitUserEditDiff[];
};
