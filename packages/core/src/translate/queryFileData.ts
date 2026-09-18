import type {
  GetFileInfoData,
  GetFileInfoResponse,
} from '@generaltranslation/api';

export type FileDataQuery = GetFileInfoData['body'];

// Compatibility response: the published arrays remain optional while the
// generated response requires both arrays.
export type FileDataResult = Partial<GetFileInfoResponse>;
