function sortKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** Serializes JSON the way downloaded GTJSON files are written: keys sorted at every depth, 2-space indent, no final newline. */
export function stringifySortedJson(value: unknown): string {
  return JSON.stringify(value, sortKeys, 2);
}
