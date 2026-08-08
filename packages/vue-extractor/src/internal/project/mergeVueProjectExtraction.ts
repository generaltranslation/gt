import type { Updates } from 'generaltranslation/types';
import type { VueProjectExtractionOutput } from '../../types.js';

/** Framework-neutral extraction output accepted by the CLI adapter. */
export type InlineExtractionOutput = {
  updates: Updates;
  errors: string[];
  warnings: string[];
};

/**
 * Appends Vue extraction to an existing framework catalog.
 *
 * Hash collisions represent one catalog entry. Their paths and source context
 * are combined without duplicating identical locations, while the primary
 * framework's ordering and update object remain authoritative.
 */
export function mergeVueProjectExtraction(
  primary: InlineExtractionOutput,
  vue: VueProjectExtractionOutput
): InlineExtractionOutput {
  return {
    updates: mergeUpdates(primary.updates, vue.updates),
    errors: [...primary.errors, ...vue.errors],
    warnings: [...new Set([...primary.warnings, ...vue.warnings])],
  };
}

function mergeUpdates(primary: Updates, vue: Updates): Updates {
  const updates = [...primary];
  const byHash = new Map(
    updates.flatMap((update, index) =>
      update.metadata.hash ? [[update.metadata.hash, index] as const] : []
    )
  );

  for (const update of vue) {
    const hash = update.metadata.hash;
    const existingIndex = hash ? byHash.get(hash) : undefined;
    if (existingIndex === undefined) {
      if (hash) byHash.set(hash, updates.length);
      updates.push(update);
      continue;
    }

    const existing = updates[existingIndex]!;
    mergeFilePaths(existing, update);
    mergeSourceCode(existing, update);
  }
  return updates;
}

function mergeFilePaths(
  existing: Updates[number],
  incoming: Updates[number]
): void {
  const paths = [
    ...(existing.metadata.filePaths ?? []),
    ...(incoming.metadata.filePaths ?? []),
  ];
  if (paths.length > 0) existing.metadata.filePaths = [...new Set(paths)];
}

function mergeSourceCode(
  existing: Updates[number],
  incoming: Updates[number]
): void {
  const incomingSourceCode = asSourceCodeMap(incoming.metadata.sourceCode);
  if (!incomingSourceCode) return;

  const currentSourceCode = existing.metadata.sourceCode;
  const existingSourceCode =
    currentSourceCode === undefined ? {} : asSourceCodeMap(currentSourceCode);
  if (!existingSourceCode) return;
  if (currentSourceCode === undefined) {
    existing.metadata.sourceCode = existingSourceCode;
  }

  for (const [file, entries] of Object.entries(incomingSourceCode)) {
    const target = (existingSourceCode[file] ??= []);
    const known = new Set(target.map(serializeSourceCodeEntry));
    for (const entry of entries) {
      const key = serializeSourceCodeEntry(entry);
      if (known.has(key)) continue;
      target.push(entry);
      known.add(key);
    }
  }
}

type SourceCodeMap = Record<string, unknown[]>;

function asSourceCodeMap(value: unknown): SourceCodeMap | undefined {
  if (!isRecord(value)) return undefined;
  if (!Object.values(value).every(Array.isArray)) return undefined;
  return value as SourceCodeMap;
}

function serializeSourceCodeEntry(entry: unknown): string {
  return JSON.stringify(entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
