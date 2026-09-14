export type FileDataQuery =
  import('@generaltranslation/api').GetFileInfoData['body'];

// Compatibility response: the published arrays remain optional while the
// generated response requires both arrays.
export type FileDataResult = Partial<
  import('@generaltranslation/api').GetFileInfoResponse
>;
