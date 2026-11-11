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

/** `valueAtPath({ nav: { home: 1 } }, ["nav", "home"])` → `1`; undefined if nothing is there. */
export function valueAtPath(
  root: JsonObject,
  keyPath: readonly string[]
): unknown {
  let value: unknown = root;

  for (const key of keyPath) {
    if (!isJsonObject(value) || !Object.hasOwn(value, key)) return undefined;

    value = value[key];
  }

  return value;
}

/** Sets the value at `keyPath`, creating the objects on the way that are missing. */
export function setAtPath(
  root: JsonObject,
  keyPath: readonly string[],
  value: unknown
): void {
  const parentKeys = keyPath.slice(0, -1);
  const lastKey = keyPath.at(-1);
  if (lastKey === undefined) return;

  let parent = root;

  for (const key of parentKeys) {
    const child = Object.hasOwn(parent, key) ? parent[key] : undefined;
    const next = isJsonObject(child) ? child : {};
    setOwnProperty(parent, key, next);
    parent = next;
  }

  setOwnProperty(parent, lastKey, value);
}

/** Assigning the key `__proto__` would change the object's prototype instead. */
function setOwnProperty(object: JsonObject, key: string, value: unknown): void {
  Object.defineProperty(object, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
