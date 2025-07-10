import { GTRequest } from './GTRequest';

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
  source: GTRequest[] | string;
  targetLocale: string;
  fileMetadata: FileMetadata;
};
