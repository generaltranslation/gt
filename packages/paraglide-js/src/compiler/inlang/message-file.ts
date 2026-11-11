import {
  isJsonObject,
  readJsonObject,
  type JsonObject,
} from '../utils/json.js';

/** `{ "nav": { "home": "Home" } }` → `{ id: "nav.home", path: ["nav", "home"] }` */
export type MessageKey = {
  /** The name Paraglide compiles the message under. */
  id: string;
  /** Where the message is in the file. */
  path: readonly string[];
};

/** A file in the inlang message format. */
export type MessageFile = {
  /** Absolute. */
  path: string;
  /** In the file's order. */
  keys: readonly MessageKey[];
};

/** Reads a message file; undefined if it is missing or not a JSON object. */
export async function readMessageFile(
  file: string
): Promise<MessageFile | undefined> {
  const content = await readJsonObject(file);
  if (!content) return undefined;

  return { path: file, keys: messageKeys(content, []) };
}

function messageKeys(
  content: JsonObject,
  parentPath: readonly string[]
): MessageKey[] {
  const keys: MessageKey[] = [];

  for (const [name, value] of Object.entries(content)) {
    const keyPath = [...parentPath, name];
    if (isJsonObject(value)) {
      keys.push(...messageKeys(value, keyPath));
      continue;
    }

    // A text, or an array of variants.
    const isMessage = typeof value === 'string' || Array.isArray(value);
    if (!isMessage) continue;

    keys.push({ id: keyPath.join('.'), path: keyPath });
  }

  return keys;
}
