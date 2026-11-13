import { linksOf, type Links, type ModuleRef } from './importers.js';
import type { ModuleRecord } from './module-graph.js';

/** Where a module graph keeps its modules. */
export interface RecordStore {
  /** Whether `file` is one of the graph's modules. */
  has(file: string): boolean;
  get(file: string): ModuleRecord | undefined;
  /** The records in memory. */
  loaded(): Iterable<ModuleRecord>;
  /** Every module's links, in loading order: a file's scripts after its module. */
  links(): Iterable<{ ref: ModuleRef; links: Links }>;
}

/** A file's module, then its scripts. */
export function modulesOf(record: ModuleRecord): ModuleRecord[] {
  return [record, ...(record.scripts ?? [])];
}

/** Every module stays in memory once loaded. */
export class LoadedRecords implements RecordStore {
  private readonly records = new Map<string, ModuleRecord>();

  set(record: ModuleRecord): void {
    this.records.set(record.file, record);
  }

  has(file: string): boolean {
    return this.records.has(file);
  }

  get(file: string): ModuleRecord | undefined {
    return this.records.get(file);
  }

  loaded(): Iterable<ModuleRecord> {
    return this.records.values();
  }

  *links(): Iterable<{ ref: ModuleRef; links: Links }> {
    for (const record of this.records.values()) {
      const modules = modulesOf(record);

      for (let part = 0; part < modules.length; part++) {
        yield {
          ref: { file: record.file, part },
          links: linksOf(modules[part]!),
        };
      }
    }
  }
}
