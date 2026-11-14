import type { GTConfig } from '../types-dir/config';

/** The environment variables GT reads credentials from. */
export const credentialEnvNames = {
  projectId: 'GT_PROJECT_ID',
  apiKey: 'GT_API_KEY',
} as const;

/** An environment such as `process.env`, read by the entry point that owns it. */
export type CredentialsEnv = Readonly<Record<string, string | undefined>>;

/** Credentials after the config and the environment are combined. A project that loads its own translations has neither. */
export type ResolvedCredentials = {
  [K in 'projectId' | 'apiKey']: GTConfig[K];
};

/**
 * Resolves credentials from a config, then the environment. An empty string
 * counts as unset. Pure: each entry point reads its own environment, once, and
 * passes it in.
 */
export function resolveCredentials(
  config: Partial<ResolvedCredentials>,
  env: CredentialsEnv
): ResolvedCredentials {
  return {
    projectId:
      config.projectId || env[credentialEnvNames.projectId] || undefined,
    apiKey: config.apiKey || env[credentialEnvNames.apiKey] || undefined,
  };
}
