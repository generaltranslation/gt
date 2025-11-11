// Mapping of locale code to source file path to translated file path
export type FileMapping = Record<string, Record<string, string>>;

export type FileProperties = {
  versionId: string;
  fileName: string;
  fileId: string;
  locale: string;
  branchId: string;
};
