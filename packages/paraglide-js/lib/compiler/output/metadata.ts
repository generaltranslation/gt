import type { FileUsages } from '../analysis/types.js';
import type { MessageKey } from '../inlang/message-file.js';
import {
  isJsonObject,
  setAtPath,
  valueAtPath,
  type JsonObject,
} from '../utils/json.js';
import { sourceCodeByMessage } from './source-code.js';

export type MetadataFileInput = {
  /** The keys of the message file the metadata is for. */
  keys: readonly MessageKey[];
  /** The usages of every analyzed source file. */
  sourceFiles: readonly FileUsages[];
  /** Only usages of this project count; compared with `ParaglideUsage.inlangProject`. */
  inlangProject: string;
  /** Lines of context above and below each usage. */
  radius: number;
  /** The metadata file's current content. Fields other than `sourceCode` are kept. */
  existing: JsonObject;
};

/** `messages/en.json` → `messages/en.metadata.json`, where the gt CLI looks for it. */
export function metadataPath(messageFile: string): string {
  return messageFile.replace(/\.json$/, '.metadata.json');
}

/**
 * The metadata of a message file, shaped like the file: under each message
 * that is used, the source code around its usages.
 */
export function renderMetadataFile({
  keys,
  sourceFiles,
  inlangProject,
  radius,
  existing,
}: MetadataFileInput): JsonObject {
  const ids = new Set(keys.map((key) => key.id));
  const sourceCode = sourceCodeByMessage(sourceFiles, {
    ids,
    inlangProject,
    radius,
  });
  const metadata: JsonObject = {};

  for (const key of keys) {
    const entry = handWrittenFields(existing, key.path);
    const usedIn = sourceCode.get(key.id);
    if (usedIn) entry.sourceCode = usedIn;

    const isEmpty = Object.keys(entry).length === 0;
    if (isEmpty) continue;

    setAtPath(metadata, key.path, entry);
  }

  return metadata;
}

/** A message's fields in the current file other than `sourceCode`, e.g. `context` and `maxChars`. */
function handWrittenFields(
  existing: JsonObject,
  keyPath: readonly string[]
): JsonObject {
  const entry = valueAtPath(existing, keyPath);
  if (!isJsonObject(entry)) return {};

  const handWritten = { ...entry };
  delete handWritten.sourceCode;

  return handWritten;
}
