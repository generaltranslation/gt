import type { InitializeGTParams } from './types';

type RuntimeCredentials = Pick<InitializeGTParams, 'projectId' | 'apiKey'>;

export function addRuntimeCredentials<T extends RuntimeCredentials>(
  config: T
): T {
  return {
    ...config,
    projectId: config.projectId || process.env.GT_PROJECT_ID,
    apiKey: config.apiKey || process.env.GT_API_KEY,
  };
}
