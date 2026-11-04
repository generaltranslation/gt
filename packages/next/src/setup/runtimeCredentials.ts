/**
 * Runtime credentials from the environment. GT_PROJECT_ID and GT_API_KEY are
 * the supported names; NEXT_PUBLIC_GT_PROJECT_ID and
 * NEXT_PUBLIC_GT_DEV_API_KEY are still read for projects set up by earlier
 * versions of gt init. In development, GT_API_KEY doubles as the hot-reload
 * key, and the RSC GTProvider passes it to client code. Production builds
 * read no development key.
 */
export function getRuntimeCredentials() {
  const apiKey = process.env.GT_API_KEY;
  return {
    projectId:
      process.env.GT_PROJECT_ID || process.env.NEXT_PUBLIC_GT_PROJECT_ID,
    apiKey,
    devApiKey:
      process.env.NODE_ENV === 'development'
        ? apiKey || process.env.NEXT_PUBLIC_GT_DEV_API_KEY
        : undefined,
  };
}
