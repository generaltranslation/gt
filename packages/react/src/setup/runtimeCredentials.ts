import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getRuntimeEnvironment, type I18nConfigParams } from 'gt-i18n/internal';

type RuntimeCredentials = Pick<I18nConfigParams, 'projectId' | 'apiKey'>;
type RuntimeEnv = {
  DEV?: boolean;
  VITE_GT_PROJECT_ID?: string;
  VITE_GT_DEV_API_KEY?: string;
};

export function addRuntimeCredentials<T extends RuntimeCredentials>(
  config: T
): Omit<T, keyof RuntimeCredentials> & RuntimeCredentials {
  const credentials = getRuntimeCredentials();
  let apiKey = config.apiKey || credentials.apiKey;
  // Anyone can read a key from a production browser bundle, so production
  // browser code never uses one; runtime translation there goes through a server.
  if (
    apiKey &&
    typeof window !== 'undefined' &&
    getRuntimeEnvironment() === 'production'
  ) {
    console.warn(apiKeyInProductionBrowserWarning);
    apiKey = undefined;
  }
  return {
    ...config,
    projectId: config.projectId || credentials.projectId,
    apiKey,
  };
}

const apiKeyInProductionBrowserWarning = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Warning',
  whatHappened:
    'An API key reached production browser code, so gt-react ignored it',
  why: 'anyone can read a key shipped in a browser bundle',
  fix: 'Remove apiKey from client code and translate at runtime on your server instead',
});

function getRuntimeCredentials(): RuntimeCredentials {
  return {
    projectId:
      readImportMetaVite(
        () =>
          (
            import.meta as ImportMeta & {
              env?: RuntimeEnv;
            }
          ).env?.VITE_GT_PROJECT_ID
      ) || readProcessEnvViteProjectId(),
    apiKey:
      getRuntimeEnvironment() === 'development'
        ? readImportMetaVite(() =>
            (import.meta as ImportMeta & { env?: RuntimeEnv }).env?.DEV
              ? (import.meta as ImportMeta & { env?: RuntimeEnv }).env
                  ?.VITE_GT_DEV_API_KEY
              : undefined
          ) || readProcessEnvViteDevApiKey()
        : undefined,
  };
}

function readImportMetaVite(
  readValue: () => string | undefined
): string | undefined {
  try {
    return normalizeEnvValue(readValue());
  } catch {
    return undefined;
  }
}

function readProcessEnvViteProjectId(): string | undefined {
  try {
    return normalizeEnvValue(process.env.VITE_GT_PROJECT_ID);
  } catch {
    return undefined;
  }
}

function readProcessEnvViteDevApiKey(): string | undefined {
  try {
    return normalizeEnvValue(process.env.VITE_GT_DEV_API_KEY);
  } catch {
    return undefined;
  }
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  return value || undefined;
}
