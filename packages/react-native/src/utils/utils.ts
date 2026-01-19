import type {
  AuthFromEnvParams,
  AuthFromEnvReturn,
} from '@generaltranslation/react-core/types';

export function readAuthFromEnv(params: AuthFromEnvParams): AuthFromEnvReturn {
  const { projectId, devApiKey } = params;
  return {
    projectId: projectId || '',
    devApiKey: devApiKey,
  };
}
