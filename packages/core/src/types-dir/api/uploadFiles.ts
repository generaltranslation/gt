import type { DataFormat } from '@generaltranslation/format';
import type { FileFormat } from '@generaltranslation/api';
import type { FormatMetadata } from './file';

export type FileUpload = {
  branchId?: string; // optional branch id. If not provided, will use the default branch.
  incomingBranchId?: string; // optional branch id to use for incoming translations
  checkedOutBranchId?: string; // optional branch id to use for checked out translations
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  // Optional output format requested for generated translations.
  transformFormat?: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
  formatMetadata?: FormatMetadata;
  versionId?: string; // Optional versionId. Only use this if you know what you are doing.
  fileId?: string; // Optional fileId. Only use this if you know what you are doing.
};
