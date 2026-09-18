// Compatibility response: this legacy published shape omits autoApprove and
// keeps defaultLocale non-null, unlike GetProjectInfoResponse.
export type ProjectData = {
  id: string;
  name: string;
  orgId: string;
  defaultLocale: string;
  currentLocales: string[];
};
