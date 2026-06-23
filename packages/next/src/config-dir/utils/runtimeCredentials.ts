type RuntimeCredentials = {
  apiKey?: string;
  devApiKey?: string;
  projectId?: string;
};

export function getRuntimeCredentials(): RuntimeCredentials {
  return {
    apiKey: process.env.GT_API_KEY,
    devApiKey:
      process.env.NEXT_PUBLIC_GT_DEV_API_KEY || process.env.GT_DEV_API_KEY,
    projectId: process.env.GT_PROJECT_ID,
  };
}

export function getDefinedRuntimeCredentials(): RuntimeCredentials {
  return Object.fromEntries(
    Object.entries(getRuntimeCredentials()).filter(([, value]) => value)
  ) as RuntimeCredentials;
}

export function withoutRuntimeCredentials<T extends RuntimeCredentials>(
  config: T
): Omit<T, keyof RuntimeCredentials> {
  const {
    apiKey: _apiKey,
    devApiKey: _devApiKey,
    projectId: _projectId,
    ...rest
  } = config;
  return rest;
}
