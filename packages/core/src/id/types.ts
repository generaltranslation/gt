import type { DataFormat } from '@generaltranslation/format';
import type { RuntimeFileFormat } from '@generaltranslation/api';

export type HashMetadata = {
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat?: DataFormat;
  fileFormat?: RuntimeFileFormat;
};
