import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  credentialEnvNames,
  resolveCredentials,
  type CredentialsEnv,
  type ResolvedCredentials,
} from 'generaltranslation/internal';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';

// gt-i18n compiles without the DOM library; only `typeof window` is used.
declare const window: unknown;

/**
 * Resolves credentials once, when a framework initializes GT, from the config
 * and then the environment. Production browser code never keeps an API key.
 *
 * @param source - The framework package, named in the warning.
 */
export function addRuntimeCredentials<T extends Partial<ResolvedCredentials>>(
  config: T,
  source: string
): Omit<T, keyof ResolvedCredentials> & ResolvedCredentials {
  const credentials = resolveCredentials(config, readCredentialsEnv());
  // Anyone can read a key from a production browser bundle, so production
  // browser code never uses one; runtime translation there goes through a server.
  if (
    credentials.apiKey &&
    typeof window !== 'undefined' &&
    getRuntimeEnvironment() === 'production'
  ) {
    console.warn(createApiKeyInProductionBrowserWarning(source));
    credentials.apiKey = undefined;
  }
  return { ...config, ...credentials };
}

const createApiKeyInProductionBrowserWarning = (source: string) =>
  createDiagnosticMessage({
    source,
    severity: 'Warning',
    whatHappened: `An API key reached production browser code, so ${source} ignored it`,
    why: 'anyone can read a key shipped in a browser bundle',
    fix: 'Remove apiKey from client code and translate at runtime on your server instead',
  });

// The GT Vite plugins define these on import.meta.env, and the API key only
// for the dev server. Server code that Vite does not bundle reads
// process.env; browser code never reads the key from there, so a bundler that
// inlines process.env cannot ship it. Plain member access is the form
// bundlers' define matches.
function readCredentialsEnv(): CredentialsEnv {
  return {
    [credentialEnvNames.projectId]:
      readEnvValue(
        () =>
          (import.meta as ImportMeta & { env: CredentialsEnv }).env
            .GT_PROJECT_ID
      ) || readEnvValue(() => process.env.GT_PROJECT_ID),
    [credentialEnvNames.apiKey]:
      readEnvValue(
        () =>
          (import.meta as ImportMeta & { env: CredentialsEnv }).env.GT_API_KEY
      ) ||
      (typeof window === 'undefined'
        ? readEnvValue(() => process.env.GT_API_KEY)
        : undefined),
  };
}

// The try/catch covers import.meta.env and process missing outside Vite and Node.
function readEnvValue(readValue: () => string | undefined): string | undefined {
  try {
    return readValue() || undefined;
  } catch {
    return undefined;
  }
}
