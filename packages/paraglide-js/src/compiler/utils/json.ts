import fsp from 'node:fs/promises';

export type JsonObject = { [key: string]: unknown };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The object `text` is the JSON of; undefined if it is invalid or anything else. */
export function parseJsonObject(text: string): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isJsonObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The object in a JSON file; undefined if the file is missing or holds anything else. */
export async function readJsonObject(
  file: string
): Promise<JsonObject | undefined> {
  const text = await fsp.readFile(file, 'utf8').catch(() => undefined);
  if (text === undefined) return undefined;

  return parseJsonObject(text);
}
