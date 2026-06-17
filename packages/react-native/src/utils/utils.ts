export type AuthFromEnvParams = {
  projectId?: string;
  devApiKey?: string;
};

export type AuthFromEnvReturn = {
  projectId: string;
  devApiKey?: string;
};

export function readAuthFromEnv(params: AuthFromEnvParams): AuthFromEnvReturn {
  const { projectId, devApiKey } = params;
  return {
    projectId: projectId || '',
    devApiKey: devApiKey,
  };
}
