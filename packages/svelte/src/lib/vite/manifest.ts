import fs from 'node:fs/promises';
import path from 'node:path';
import type { JsxChildren } from 'generaltranslation/types';

export type ManifestMetadata = {
  hash: string;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  filePaths: string[];
};

/** One translatable entry, in the shape the gt CLI uploads. */
export type ManifestEntry =
  | { dataFormat: 'STRING'; source: string; metadata: ManifestMetadata }
  | { dataFormat: 'JSX'; source: JsxChildren; metadata: ManifestMetadata };

/** Entries per module, so a rebuilt module replaces only its own entries. */
export class ManifestCollector {
  readonly #modules = new Map<string, ManifestEntry[]>();

  set(moduleId: string, entries: ManifestEntry[]): void {
    if (entries.length) this.#modules.set(moduleId, entries);
    else this.#modules.delete(moduleId);
  }

  entries(): ManifestEntry[] {
    const byHash = new Map<string, ManifestEntry>();
    for (const entries of this.#modules.values()) {
      for (const entry of entries) {
        const existing = byHash.get(entry.metadata.hash);
        if (!existing) {
          byHash.set(entry.metadata.hash, {
            ...entry,
            metadata: { ...entry.metadata },
          } as ManifestEntry);
          continue;
        }
        existing.metadata.filePaths = [
          ...new Set([
            ...existing.metadata.filePaths,
            ...entry.metadata.filePaths,
          ]),
        ];
      }
    }
    return [...byHash.values()]
      .map((entry) => {
        entry.metadata.filePaths.sort();
        return entry;
      })
      .sort((a, b) =>
        a.metadata.hash < b.metadata.hash
          ? -1
          : a.metadata.hash > b.metadata.hash
            ? 1
            : 0
      );
  }

  async write(file: string): Promise<void> {
    const content = `${JSON.stringify(this.entries(), null, 2)}\n`;
    const existing = await fs.readFile(file, 'utf8').catch(() => undefined);
    if (existing === content) return;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
}
