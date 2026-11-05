/**
 * Runtime credentials from the environment. In development, GT_API_KEY doubles
 * as the hot-reload key, and withGTConfig passes both to client code.
 * Production builds read no development key.
 */
export function getRuntimeCredentials() {
  const apiKey = process.env.GT_API_KEY;
  return {
    projectId: process.env.GT_PROJECT_ID,
    apiKey,
    devApiKey: process.env.NODE_ENV === 'development' ? apiKey : undefined,
  };
}
