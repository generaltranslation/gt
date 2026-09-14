import type { GetProjectInfoResponse } from '@generaltranslation/api';

// Compatibility response: defaultLocale remains non-null and autoApprove
// optional on the published API, unlike the generated wire contract.
export type ProjectInfoResult = Omit<
  GetProjectInfoResponse,
  'defaultLocale' | 'autoApprove'
> & {
  defaultLocale: string;
  autoApprove?: boolean;
};

export type GetProjectInfoOptions = {
  timeout?: number;
};
