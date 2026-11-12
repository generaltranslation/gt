import type { ContentFor, DataFormat } from '@generaltranslation/format/types';

type UpdateMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat?: DataFormat;
  actionType?: 'standard' | 'fast' | string;
  staticId?: string;
  format?: string;
  filePaths?: string[];
  sourceCode?: unknown;
  contextDeriveExpr?: unknown;
  _contextDeriveExpr?: unknown;
  [key: string]: unknown;
};

// Types for the enqueueTranslationEntries function
export type Updates = ({
  metadata: UpdateMetadata;
} & {
  [Format in DataFormat]: { dataFormat: Format; source: ContentFor<Format> };
}[DataFormat])[];
