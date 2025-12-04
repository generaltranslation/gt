import { DataFormat } from '../types-dir/jsx/content';

export type HashMetadata = {
  context?: string;
  id?: string;
  maxChars?: number;
  dataFormat: DataFormat;
};
