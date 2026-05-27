/**
 * Configuration fields used to determine whether GT cloud services are enabled.
 */
export type GTServicesSetupParams = {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};
