export type OrphanedFile =
  import('@generaltranslation/api').GetOrphanedFilesResponse['orphanedFiles'][number];

export type GetOrphanedFilesResult =
  import('@generaltranslation/api').GetOrphanedFilesResponse;
