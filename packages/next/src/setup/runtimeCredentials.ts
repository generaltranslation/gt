/**
 * Runtime credentials from the environment. In development, withGTConfig also
 * passes both to client code for hot reload; production client code gets no
 * key.
 */
export function getRuntimeCredentials() {
  return {
    projectId: process.env.GT_PROJECT_ID,
    apiKey: process.env.GT_API_KEY,
  };
}
