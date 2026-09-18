import type { GetProjectInfoResponse } from '@generaltranslation/api';

// Compatibility response: this legacy published shape omits autoApprove.
export type ProjectData = Omit<GetProjectInfoResponse, 'autoApprove'>;
