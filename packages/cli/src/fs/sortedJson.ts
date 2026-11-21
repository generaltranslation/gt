function sortKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** Serializes JSON with keys sorted at every depth; the default indent and no final newline match downloaded GTJSON files. */
export function stringifySortedJson(value: unknown, indent = 2): string {
  return JSON.stringify(value, sortKeys, indent);
}
