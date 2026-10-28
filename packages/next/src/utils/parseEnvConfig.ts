import { createInvalidEnvConfigError } from '../errors/envConfig';

/** Parses a JSON env var written by `withGTConfig()`. */
export function parseEnvConfig<T extends object>(
  envName: string,
  value: string | undefined
): Partial<T> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Partial<T>;
  } catch (error) {
    console.error(createInvalidEnvConfigError(envName, error));
    return {};
  }
}
