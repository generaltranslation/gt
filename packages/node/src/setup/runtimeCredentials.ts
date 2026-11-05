import type { InitializeGTParams } from './types';

type RuntimeCredentials = Pick<
  InitializeGTParams,
  'projectId' | 'apiKey' | 'devApiKey'
>;

export function addRuntimeCredentials<T extends RuntimeCredentials>(
  config: T
): T {
  const credentials = getRuntimeCredentials();
  return {
    ...config,
    projectId: config.projectId || credentials.projectId,
    apiKey: config.apiKey || credentials.apiKey,
    devApiKey: config.devApiKey || credentials.devApiKey,
  };
}

// In development, GT_API_KEY doubles as the hot-reload key.
function getRuntimeCredentials(): RuntimeCredentials {
  const apiKey = process.env.GT_API_KEY;
  return {
    projectId: process.env.GT_PROJECT_ID,
    apiKey,
    devApiKey: process.env.NODE_ENV === 'development' ? apiKey : undefined,
  };
}
