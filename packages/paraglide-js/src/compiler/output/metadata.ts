import { native } from '../analysis/native.js';
import type { FileUsages } from '../analysis/types.js';
import type { MessageKey } from '../inlang/message-file.js';

/** `messages/en.json` → `messages/en.metadata.json`, where the gt CLI looks for it. */
export function metadataPath(messageFile: string): string {
  return messageFile.replace(/\.json$/, '.metadata.json');
}

/** A message key as the analysis is given it. */
export type NativeMessageKey = [id: string, path: readonly string[]];

export function nativeKeys(keys: readonly MessageKey[]): NativeMessageKey[] {
  return keys.map(({ id, path }) => [id, path]);
}

/**
 * What the analysis writes the metadata files from, besides the code and
 * usages it kept of the files it analyzed. Given as JSON: its strings stay
 * JavaScript's exactly, lone surrogates included.
 */
export type MetadataInput = {
  /** The analyzed files that have usages, absolute. */
  files: string[];
  /** How the metadata names each of `files`: project-relative. */
  names: string[];
  /** The message files that usages resolve to, absolute… */
  targets: string[];
  /** …and the inlang project each is paired with, project-relative: a message's usage counts for it. */
  targetProjects: string[];
  /** In the order their skipped files are reported. */
  projects: Array<{
    /** Project-relative. */
    inlangProject: string;
    messageFiles: Array<{ metadata: string; keys: NativeMessageKey[] }>;
  }>;
};

export type MetadataFileInput = {
  /** The keys of the message file the metadata is for. */
  keys: readonly MessageKey[];
  /** The source files and their usages. */
  sources: readonly FileUsages[];
  /** Only usages of this project count; compared with `ParaglideUsage.inlangProject`. */
  inlangProject: string;
  /** Lines of context above and below each usage. */
  radius: number;
  /** The metadata file's current content. Fields other than `sourceCode` are kept. */
  existing: string;
};

/**
 * The content of a message file's metadata file, as the collector writes it:
 * shaped like the message file, with under each message that is used the
 * source code around its usages, by source file. Undefined if `existing` is
 * not the JSON of an object.
 *
 * The collector does not call it: the analysis writes the files itself, from
 * the code it kept. This is the same rendering, for what JavaScript has.
 */
export function renderMetadataFile({
  keys,
  sources,
  inlangProject,
  radius,
  existing,
}: MetadataFileInput): string | undefined {
  const input = JSON.stringify({
    inlangProject,
    keys: nativeKeys(keys),
    existing,
    sources,
  });

  try {
    return native.renderMetadata(input, radius) ?? undefined;
  } catch (error) {
    throw tooDeepAsRangeError(error);
  }
}

/** As `JSON.stringify` fails on a value nested too deep. */
export function tooDeepError(): RangeError {
  return new RangeError('Maximum call stack size exceeded');
}

function tooDeepAsRangeError(error: unknown): unknown {
  const isTooDeep =
    error instanceof Error && error.message === tooDeepError().message;

  return isTooDeep ? tooDeepError() : error;
}
