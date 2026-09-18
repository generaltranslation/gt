import type { FileReference } from '../types-dir/api/file';

// Compatibility input: branchId stays required for published callers while
// the generated setup request permits the default branch.
export type SetupProjectFileReference = Pick<
  FileReference,
  'branchId' | 'fileId' | 'versionId'
>;

export type SetupProjectResult =
  import('@generaltranslation/api').GenerateProjectContextResponse;

export type SetupProjectOptions = {
  force?: boolean;
  locales?: string[];
  timeoutMs?: number;
};
