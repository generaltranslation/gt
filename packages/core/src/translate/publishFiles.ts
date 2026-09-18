// Compatibility input: fileName is retained for published callers even though
// the generated request ignores it.
export type PublishFileEntry =
  import('@generaltranslation/api').PublishFilesData['body']['files'][number] & {
    fileName?: string;
  };

export type PublishFilesResult =
  import('@generaltranslation/api').PublishFilesResponse;
