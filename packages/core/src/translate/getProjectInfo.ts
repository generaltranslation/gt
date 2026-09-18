// Compatibility response: defaultLocale remains non-null and autoApprove
// optional on the published API, unlike the generated wire contract.
export type ProjectInfoResult = {
  id: string;
  name: string;
  orgId: string;
  defaultLocale: string;
  currentLocales: string[];
  autoApprove?: boolean;
};

export type GetProjectInfoOptions = {
  timeout?: number;
};
