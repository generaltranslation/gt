import dotenv from 'dotenv';
import { credentialEnvNames } from 'generaltranslation/internal';

/** Env files read at startup, in order; each one after the first overrides the shell. */
export const envFiles = ['.env', '.env.local', '.env.production'] as const;

let envFileApiKey: string | undefined;

/** The GT_API_KEY value an env file supplied, when the shell set none. */
export function getEnvFileApiKey(): string | undefined {
  return envFileApiKey;
}

/** Load executable startup env files without contaminating command stdout. */
export function loadEnv(): void {
  const shellApiKey = process.env[credentialEnvNames.apiKey];
  /* eslint-disable no-console -- dotenv 16's vault warnings bypass quiet via console.log. */
  const log = console.log;
  // Keep this override synchronous; remove it when dotenv supports stderr diagnostics.
  console.log = console.error;
  try {
    for (const [index, path] of envFiles.entries()) {
      dotenv.config({ path, override: index > 0 });
    }
  } finally {
    console.log = log;
  }
  /* eslint-enable no-console */
  // An env file's GT_API_KEY is the app's runtime key, so an explicit shell or
  // CI key keeps priority for the CLI.
  if (shellApiKey !== undefined) {
    process.env[credentialEnvNames.apiKey] = shellApiKey;
  }
  envFileApiKey =
    shellApiKey === undefined
      ? process.env[credentialEnvNames.apiKey]
      : undefined;
}
