import { getRuntimeEnvironment } from 'gt-i18n/internal';
import type { I18nConfigParams } from 'gt-i18n/internal/types';

type RuntimeCredentials = Pick<I18nConfigParams, 'projectId' | 'devApiKey'>;
type RuntimeEnv = {
  DEV?: boolean;
  VITE_GT_PROJECT_ID?: string;
  VITE_GT_DEV_API_KEY?: string;
};

export function addRuntimeCredentials<T extends RuntimeCredentials>(
  config: T
): T {
  const credentials = getRuntimeCredentials();
  return {
    ...config,
    projectId: config.projectId || credentials.projectId,
    devApiKey: config.devApiKey || credentials.devApiKey,
  };
}

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
    devApiKey:
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
