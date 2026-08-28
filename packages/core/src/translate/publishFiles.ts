// Compatibility input: fileName is retained for published callers even though
// the generated request ignores it.
export type PublishFileEntry = {
  fileId: string;
  versionId: string;
  branchId?: string;
  publish: boolean;
  fileName?: string;
};

export type PublishFilesResult =
  import('@generaltranslation/api').PublishFilesResponse;
