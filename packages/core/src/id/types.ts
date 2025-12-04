import { DataFormat } from 'src/types';

export type HashMetadata = {
  context?: string;
  id?: string;
  maxChars?: number;
  dataFormat: DataFormat;
};
