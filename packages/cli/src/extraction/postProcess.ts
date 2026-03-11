import { Updates } from '../types/index.js';
import { hashSource, hashString } from 'generaltranslation/id';
import type { SourceCode } from '../react/jsx/utils/extractSourceCode.js';

/**
 * Calculate hashes for all updates in parallel
 */
export async function calculateHashes(updates: Updates): Promise<void> {
  await Promise.all(
    updates.map(async (update) => {
      const hash = hashSource({
        source: update.source,
        ...(update.metadata.context && { context: update.metadata.context }),
        ...(update.metadata.id && { id: update.metadata.id }),
        ...(update.metadata.maxChars != null && {
          maxChars: update.metadata.maxChars,
        }),
        dataFormat: update.dataFormat,
      });
      update.metadata.hash = hash;
    })
  );
}

/**
 * Dedupe entries by hash, merging filePaths
 */
export function dedupeUpdates(updates: Updates): void {
  const mergedByHash = new Map<string, (typeof updates)[number]>();
  const noHashUpdates: (typeof updates)[number][] = [];

  for (const update of updates) {
    const hash = update.metadata.hash;
    if (!hash) {
      noHashUpdates.push(update);
      continue;
    }

    const existing = mergedByHash.get(hash);
    if (!existing) {
      mergedByHash.set(hash, update);
      continue;
    }

    const existingPaths = Array.isArray(existing.metadata.filePaths)
      ? existing.metadata.filePaths.slice()
      : [];
    const newPaths = Array.isArray(update.metadata.filePaths)
      ? update.metadata.filePaths
      : [];

    for (const p of newPaths) {
      if (!existingPaths.includes(p)) {
        existingPaths.push(p);
      }
    }

    if (existingPaths.length) {
      existing.metadata.filePaths = existingPaths;
    }

    // Merge sourceCode entries
    const newSourceCode = update.metadata.sourceCode as
      | Record<string, SourceCode[]>
      | undefined;
    if (newSourceCode && typeof newSourceCode === 'object') {
      if (!existing.metadata.sourceCode) {
        existing.metadata.sourceCode = {};
      }
      const existingSourceCode = existing.metadata.sourceCode as Record<
        string,
        SourceCode[]
      >;
      for (const [file, entries] of Object.entries(newSourceCode)) {
        if (!existingSourceCode[file]) {
          existingSourceCode[file] = [];
        }
        existingSourceCode[file].push(...entries);
      }
    }
  }

  const mergedUpdates = [...mergedByHash.values(), ...noHashUpdates];
  updates.splice(0, updates.length, ...mergedUpdates);
}

/**
 * Mark static updates as related by attaching a shared id to static content.
 * Id is calculated as the hash of the static children's combined hashes.
 */
export function linkStaticUpdates(updates: Updates): void {
  const temporaryStaticIdToUpdates = updates.reduce(
    (acc: Record<string, Updates[number][]>, update: Updates[number]) => {
      if (update.metadata.staticId) {
        if (!acc[update.metadata.staticId]) {
          acc[update.metadata.staticId] = [];
        }
        acc[update.metadata.staticId].push(update);
      }
      return acc;
    },
    {} as Record<string, Updates[number][]>
  );

  Object.values(temporaryStaticIdToUpdates).forEach((staticUpdates) => {
    const hashes = staticUpdates
      .map((update) => update.metadata.hash)
      .sort()
      .join('-');
    const sharedStaticId = hashString(hashes);
    staticUpdates.forEach((update) => {
      update.metadata.staticId = sharedStaticId;
    });
  });
}
