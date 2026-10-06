import dotenv from 'dotenv';

/** Env files read at startup, in order; each one after the first overrides the shell. */
export const envFiles = ['.env', '.env.local', '.env.production'] as const;

/** Load executable startup env files without contaminating command stdout. */
export function loadEnv(): void {
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
}
