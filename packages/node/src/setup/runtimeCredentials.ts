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

function getRuntimeCredentials(): RuntimeCredentials {
  return {
    projectId: process.env.GT_PROJECT_ID,
    apiKey: process.env.GT_API_KEY,
    devApiKey: process.env.GT_DEV_API_KEY,
  };
}
