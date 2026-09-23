import dotenv from 'dotenv';

/** Load executable startup env files without contaminating command stdout. */
export function loadEnv(): void {
  /* eslint-disable no-console -- dotenv 16's vault warnings bypass quiet via console.log. */
  const log = console.log;
  // Keep this routing synchronous and scoped to dotenv, not command execution.
  console.log = console.error;
  try {
    dotenv.config({ path: '.env' });
    dotenv.config({ path: '.env.local', override: true });
    dotenv.config({ path: '.env.production', override: true });
  } finally {
    console.log = log;
  }
  /* eslint-enable no-console */
}
