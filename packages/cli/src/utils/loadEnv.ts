import dotenv from 'dotenv';

/** Env files read at startup, in order; each one after the first overrides the shell. */
export const envFiles = ['.env', '.env.local', '.env.production'] as const;

let envFileApiKey: string | undefined;

/** The GT_API_KEY value an env file supplied, if it replaced the shell's. */
export function getEnvFileApiKey(): string | undefined {
  return envFileApiKey;
}

/** Load executable startup env files without contaminating command stdout. */
export function loadEnv(): void {
  const shellApiKey = process.env.GT_API_KEY;
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
  envFileApiKey =
    process.env.GT_API_KEY !== shellApiKey ? process.env.GT_API_KEY : undefined;
  /* eslint-enable no-console */
}
