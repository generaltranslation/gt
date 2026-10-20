import type {
  PublishFilesData,
  PublishFilesResponse,
} from '@generaltranslation/api';

export type PublishFileEntry = PublishFilesData['body']['files'][number];

export type PublishFilesResult = PublishFilesResponse;
