import type { GetProjectInfoResponse } from '@generaltranslation/api';

// Compatibility response: this legacy published shape omits autoApprove and
// keeps defaultLocale non-null, unlike GetProjectInfoResponse.
export type ProjectData = Omit<
  GetProjectInfoResponse,
  'defaultLocale' | 'autoApprove'
> & {
  defaultLocale: string;
};
