/**
 * Runtime credentials from the environment. The development key is read only
 * in development, so production builds ignore one left in .env.local. In
 * development, withGTConfig also passes the server-only key to client code
 * as _GENERALTRANSLATION_DEV_*.
 */
export function getRuntimeCredentials() {
  const development = process.env.NODE_ENV === 'development';
  return {
    projectId:
      process.env.NEXT_PUBLIC_GT_PROJECT_ID ||
      process.env.GT_PROJECT_ID ||
      (development
        ? process.env._GENERALTRANSLATION_DEV_PROJECT_ID
        : undefined),
    apiKey: process.env.GT_API_KEY,
    devApiKey: development
      ? process.env.NEXT_PUBLIC_GT_DEV_API_KEY ||
        process.env.GT_DEV_API_KEY ||
        process.env._GENERALTRANSLATION_DEV_API_KEY
      : undefined,
  };
}
