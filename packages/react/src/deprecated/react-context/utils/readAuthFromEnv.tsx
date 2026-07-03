import type {
  AuthFromEnvParams,
  AuthFromEnvReturn,
} from '@generaltranslation/react-core/types';

type Env = Record<string, string | undefined>;

/**
 * Extract the project ID and development API key from the environment variables
 * @param projectId - The project ID
 * @param devApiKey - The development API key
 * @returns The project ID and development API key
 */
export function readAuthFromEnv({
  projectId,
  devApiKey,
}: AuthFromEnvParams): AuthFromEnvReturn {
  const env = {
    ...(typeof process !== 'undefined' ? process.env : undefined),
    // CJS builds define import.meta.env as {}, so Vite/Redwood vars are only
    // reachable in ESM/browser bundles.
    ...(import.meta.env as unknown as Env | undefined),
  };

  return {
    projectId:
      projectId ||
      env.VITE_GT_PROJECT_ID ||
      env.REDWOOD_ENV_GT_PROJECT_ID ||
      env.GT_PROJECT_ID ||
      env.REACT_APP_GT_PROJECT_ID ||
      env.NEXT_PUBLIC_GT_PROJECT_ID ||
      env.GATSBY_GT_PROJECT_ID ||
      '',
    devApiKey:
      devApiKey ||
      env.VITE_GT_DEV_API_KEY ||
      env.VITE_GT_API_KEY ||
      env.REDWOOD_ENV_GT_DEV_API_KEY ||
      env.REDWOOD_ENV_GT_API_KEY ||
      env.GT_DEV_API_KEY ||
      env.GT_API_KEY ||
      env.REACT_APP_GT_DEV_API_KEY ||
      env.REACT_APP_GT_API_KEY ||
      env.NEXT_PUBLIC_GT_DEV_API_KEY ||
      env.NEXT_PUBLIC_GT_API_KEY ||
      env.GATSBY_GT_DEV_API_KEY ||
      env.GATSBY_GT_API_KEY,
  };
}
