import type { GetProjectInfoResponse } from '@generaltranslation/api';

// Compatibility response: autoApprove stays optional on the published API.
export type ProjectInfoResult = Omit<GetProjectInfoResponse, 'autoApprove'> & {
  autoApprove?: boolean;
};

export type GetProjectInfoOptions = {
  timeout?: number;
};
