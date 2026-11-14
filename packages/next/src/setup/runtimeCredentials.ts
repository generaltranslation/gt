import {
  credentialEnvNames,
  resolveCredentials,
  type ResolvedCredentials,
} from 'generaltranslation/internal';

/**
 * Resolves credentials from the config, then the environment, when
 * withGTConfig() runs and when gt-next is initialized in each process.
 * withGTConfig() serializes a configured project ID and never the API key, so
 * a server reads the key from its own environment. In development it also
 * passes both to client code for hot reload through Next's `env`, which
 * replaces these exact member expressions; production client code gets no key.
 */
export function getRuntimeCredentials(
  config: Partial<ResolvedCredentials>
): ResolvedCredentials {
  return resolveCredentials(config, {
    [credentialEnvNames.projectId]: process.env.GT_PROJECT_ID,
    [credentialEnvNames.apiKey]: process.env.GT_API_KEY,
  });
}
