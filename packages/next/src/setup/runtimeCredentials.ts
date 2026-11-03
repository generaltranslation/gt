/**
 * Runtime credentials from the environment. The development key is read only
 * in development: production builds ignore it (and a NEXT_PUBLIC_ key is
 * dropped from client bundles with the dead branch), so a key left in
 * .env.local does not affect `next build`.
 */
export function getRuntimeCredentials() {
  return {
    projectId:
      process.env.NEXT_PUBLIC_GT_PROJECT_ID || process.env.GT_PROJECT_ID,
    apiKey: process.env.GT_API_KEY,
    devApiKey:
      process.env.NODE_ENV === 'development'
        ? process.env.NEXT_PUBLIC_GT_DEV_API_KEY || process.env.GT_DEV_API_KEY
        : undefined,
  };
}
