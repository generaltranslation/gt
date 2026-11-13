/**
 * The metadata files as the TypeScript implementation rendered them, before the
 * analysis wrote them itself: what `renderMetadataFile` is compared with. Kept
 * as it was, from `src/compiler/output/source-code.ts`, `output/metadata.ts`
 * and `utils/json.ts`.
 */
import type {
  FileUsages,
  ParaglideUsage,
} from '../../src/compiler/analysis/types.js';
import type { MessageKey } from '../../src/compiler/inlang/message-file.js';
import { matchingIds } from '../../src/compiler/paraglide/catalog.js';
import {
  isJsonObject,
  parseJsonObject,
  type JsonObject,
} from '../../src/compiler/utils/json.js';
import { compareText } from '../../src/compiler/utils/sort.js';

/** The content of a metadata file; undefined if `existing` is not the JSON of an object. */
export function referenceMetadataFile({
  keys,
  sources,
  inlangProject,
  radius,
  existing,
}: {
  keys: readonly MessageKey[];
  sources: readonly FileUsages[];
  inlangProject: string;
  radius: number;
  existing: string;
}): string | undefined {
  const parsed = parseJsonObject(existing);
  if (!parsed) return undefined;

  const sourceCode = sourceCodeByMessage(sources, {
    ids: new Set(keys.map(({ id }) => id)),
    inlangProject,
    radius,
  });
  const metadata = renderMetadataObject({ keys, sourceCode, existing: parsed });

  return `${JSON.stringify(metadata, null, 2)}\n`;
}

export type SourceCode = { before: string; target: string; after: string };

/** A message's snippets, by project-relative source file: what the gt CLI reads as `sourceCode`. */
export type SourceCodeByFile = Record<string, SourceCode[]>;

export type SourceCodeOptions = {
  /** The messages snippets are collected for. */
  ids: ReadonlySet<string>;
  /** Only usages of this project count; compared with `ParaglideUsage.inlangProject`. */
  inlangProject: string;
  /** Lines of context above and below each usage. */
  radius: number;
};

type LocatedUsage = {
  /** Project-relative. */
  file: string;
  lines: readonly string[];
  usage: ParaglideUsage;
};

type MessageSnippet = { id: string; file: string; snippet: SourceCode };

/** For each message that is used, the source code around its usages. */
export function sourceCodeByMessage(
  sourceFiles: readonly FileUsages[],
  options: SourceCodeOptions
): Map<string, SourceCodeByFile> {
  const byMessage = new Map<string, SourceCodeByFile>();

  for (const { id, file, snippet } of messageSnippets(sourceFiles, options)) {
    const byFile = byMessage.get(id) ?? {};
    const snippets = (byFile[file] ??= []);
    byMessage.set(id, byFile);

    // Usages on the same lines, e.g. `a ? m.x() : m.x()`.
    const isRepeated = snippets.some((other) => isSameSnippet(other, snippet));
    if (isRepeated) continue;

    snippets.push(snippet);
  }

  return byMessage;
}

/** `radius` of the file's `lines` around a usage, and the usage's own lines. */
export function sourceSnippet(
  lines: readonly string[],
  usage: Pick<ParaglideUsage, 'line' | 'endLine'>,
  radius: number
): SourceCode {
  const start = usage.line - 1;
  const end = usage.endLine;

  return {
    before: lines.slice(Math.max(0, start - radius), start).join('\n'),
    target: lines.slice(start, end).join('\n'),
    after: lines.slice(end, end + radius).join('\n'),
  };
}

function messageSnippets(
  sourceFiles: readonly FileUsages[],
  { ids, inlangProject, radius }: SourceCodeOptions
): MessageSnippet[] {
  const usages = projectUsages(sourceFiles, inlangProject);

  return usages.flatMap(({ file, lines, usage }) => {
    const named = namedMessages(usage, ids);
    if (named.length === 0) return [];

    const snippet = sourceSnippet(lines, usage, radius);

    return named.map((id) => ({ id, file, snippet }));
  });
}

/** The project's usages, in an order that does not depend on the analysis. */
function projectUsages(
  sourceFiles: readonly FileUsages[],
  inlangProject: string
): LocatedUsage[] {
  const sorted = [...sourceFiles].sort((a, b) => compareText(a.file, b.file));

  return sorted.flatMap(({ file, code, usages }) => {
    const ofProject = usages.filter(
      (usage) => usage.inlangProject === inlangProject
    );
    if (ofProject.length === 0) return [];

    const lines = code.split(/\r?\n/);

    return ofProject
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((usage) => ({ file, lines, usage }));
  });
}

/** The messages a usage names: its own, or every match of a dynamic name like `error_*`. */
function namedMessages(
  usage: ParaglideUsage,
  ids: ReadonlySet<string>
): readonly string[] {
  if (!usage.dynamic) return ids.has(usage.name) ? [usage.name] : [];

  // `m[key]` says nothing about any one message.
  const isAnyMessage = usage.name.replaceAll('*', '') === '';
  if (isAnyMessage) return [];

  return matchingIds(usage.name, ids);
}

function isSameSnippet(a: SourceCode, b: SourceCode): boolean {
  return a.before === b.before && a.target === b.target && a.after === b.after;
}

export type MetadataObjectInput = {
  /** The keys of the message file the metadata is for. */
  keys: readonly MessageKey[];
  /** The source code around the usages of each message id: see `sourceCodeByMessage`. */
  sourceCode: ReadonlyMap<string, SourceCodeByFile>;
  /** The metadata file's current content. Fields other than `sourceCode` are kept. */
  existing: JsonObject;
};

/**
 * The metadata of a message file, shaped like the file: under each message
 * that is used, the source code around its usages.
 */
export function renderMetadataObject({
  keys,
  sourceCode,
  existing,
}: MetadataObjectInput): JsonObject {
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
