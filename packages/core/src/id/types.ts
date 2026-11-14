import type { DataFormat } from '@generaltranslation/format/types';
import type { RuntimeFileFormat } from '@generaltranslation/api';

export type HashMetadata = {
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat?: DataFormat;
  fileFormat?: RuntimeFileFormat;
};

/** The metadata a message tree is hashed with. */
export type MessageTreeHashMetadata = Pick<
  HashMetadata,
  'context' | 'maxChars' | 'requiresReview'
>;
