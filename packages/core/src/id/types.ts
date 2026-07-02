import type { DataFormat } from '@generaltranslation/format/types';

export type HashMetadata = {
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat?: DataFormat;
};
