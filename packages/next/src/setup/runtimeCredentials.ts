const DEV_API_KEY_ENV_VARIABLES = [
  'NEXT_PUBLIC_GT_DEV_API_KEY',
  'GT_DEV_API_KEY',
] as const;

/** The environment variable a development key was read from, if any. */
export function getDevApiKeyEnvVariable(devApiKey: string) {
  return DEV_API_KEY_ENV_VARIABLES.find(
    (name) => process.env[name] === devApiKey
  );
}

export function getRuntimeCredentials() {
  return {
    projectId:
      process.env.NEXT_PUBLIC_GT_PROJECT_ID || process.env.GT_PROJECT_ID,
    apiKey: process.env.GT_API_KEY,
    devApiKey:
      process.env.NEXT_PUBLIC_GT_DEV_API_KEY || process.env.GT_DEV_API_KEY,
  };
}
