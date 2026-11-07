import { createInvalidEnvConfigError } from '../errors/envConfig';

/** Parses a JSON env var written by `withGTConfig()`. */
export function parseEnvConfig<T extends object>(
  envName: string,
  value: string | undefined
): Partial<T> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    // Valid JSON that is not an object, such as null, means unset.
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : {};
  } catch (error) {
    console.error(createInvalidEnvConfigError(envName, error));
    return {};
  }
}
