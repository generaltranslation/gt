import { Entry } from './entry';

export type FileFormat =
  | 'GTJSON'
  | 'JSON'
  | 'YAML'
  | 'MDX'
  | 'MD'
  | 'TS'
  | 'JS';

export type FileMetadata = {
  filePath: string;
  fileFormat: FileFormat;
  context?: string;
  sourceLocale?: string;
  hash?: string;
};

export type File = {
  source: Entry[] | string;
  fileMetadata: FileMetadata;
};

export type CompletedFileTranslationData = {
  locale: string;
  metadata: any;
  fileId: string;
  fileName: string;
  versionId: string;
  id: string; // Include ID for downloading
  isReady: boolean;
  downloadUrl: string;
};
