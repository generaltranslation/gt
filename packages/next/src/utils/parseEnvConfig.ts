/** Parses a JSON env var written by `withGTConfig()`. */
export function parseEnvConfig<T extends object>(
  value: string | undefined
): Partial<T> {
  return JSON.parse(value || '{}');
}
