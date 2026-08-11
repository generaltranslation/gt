import type { Updates } from 'generaltranslation/types';
import type {
  VueProjectExtractionOutput,
  VueProjectExtractionResult,
} from '../../types.js';

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
 * framework's ordering and catalog value remain authoritative. Primary input
 * objects are never mutated and their diagnostics retain their original
 * ordering and multiplicity.
 */
export function mergeVueProjectExtraction(
  primary: InlineExtractionOutput,
  vue: VueProjectExtractionOutput
): InlineExtractionOutput {
  return {
    updates: mergeUpdates(primary.updates, vue.updates),
    errors: [...primary.errors, ...vue.errors],
    warnings: [...primary.warnings, ...vue.warnings],
  };
}

function mergeUpdates(
  primary: Updates,
  vue: VueProjectExtractionResult[]
): Updates {
  const updates = [...primary];
  const byHash = new Map(
    updates.flatMap((update, index) =>
      update.metadata.hash ? [[update.metadata.hash, index] as const] : []
    )
  );

  for (const update of vue) {
    // The shared Updates type predates boolean/null branch wire sources.
    // Runtime consumers already accept them; keep the cast at this adapter.
    const compatibleUpdate = update as Updates[number];
    const hash = update.metadata.hash;
    const existingIndex = hash ? byHash.get(hash) : undefined;
    if (existingIndex === undefined) {
      if (hash) byHash.set(hash, updates.length);
      updates.push(compatibleUpdate);
      continue;
    }

    const existing = updates[existingIndex]!;
    updates[existingIndex] = {
      ...existing,
      metadata: {
        ...existing.metadata,
        ...mergeFilePaths(existing, compatibleUpdate),
        ...mergeSourceCode(existing, compatibleUpdate),
      },
    };
  }
  return updates;
}

function mergeFilePaths(
  existing: Updates[number],
  incoming: Updates[number]
): Pick<Updates[number]['metadata'], 'filePaths'> {
  const paths = [
    ...(existing.metadata.filePaths ?? []),
    ...(incoming.metadata.filePaths ?? []),
  ];
  return paths.length > 0 ? { filePaths: [...new Set(paths)] } : {};
}

function mergeSourceCode(
  existing: Updates[number],
  incoming: Updates[number]
): Pick<Updates[number]['metadata'], 'sourceCode'> {
  const incomingSourceCode = asSourceCodeMap(incoming.metadata.sourceCode);
  if (!incomingSourceCode) return {};

  const currentSourceCode = existing.metadata.sourceCode;
  const existingSourceCode =
    currentSourceCode === undefined ? {} : asSourceCodeMap(currentSourceCode);
  if (!existingSourceCode) return {};
  const mergedSourceCode = Object.fromEntries(
    Object.entries(existingSourceCode).map(([file, entries]) => [
      file,
      [...entries],
    ])
  );

  for (const [file, entries] of Object.entries(incomingSourceCode)) {
    const target = (mergedSourceCode[file] ??= []);
    const known = new Set(target.map(serializeSourceCodeEntry));
    for (const entry of entries) {
      const key = serializeSourceCodeEntry(entry);
      if (known.has(key)) continue;
      target.push(entry);
      known.add(key);
    }
  }
  return { sourceCode: mergedSourceCode };
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
