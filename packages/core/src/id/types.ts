import type { DataFormat } from '@generaltranslation/format/types';

export type HashMetadata = {
  context?: string;
  /**
   * @deprecated Custom IDs are not used by current translation tooling. This
   * field will be removed in the next major version. Omit it to use the
   * content-based hash.
   */
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat?: DataFormat;
};
