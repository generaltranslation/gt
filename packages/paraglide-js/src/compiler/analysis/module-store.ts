import { parsedRange } from './ast.js';
import {
  linksOf,
  resolveLinks,
  type Links,
  type ModuleRef,
  type SpecifierLinks,
} from './importers.js';
import type { ModuleRecord, ParsedModule } from './module-graph.js';
import { hasName, type NameList } from '../utils/name-list.js';

/** What the analysis knows of a module without its syntax tree. */
export type ModuleSummary = {
  file: string;
  /** The file's module, then its scripts. */
  parts: ReadonlyArray<{
    /** The file each loaded specifier resolves to. */
    resolved: ReadonlyArray<readonly [string, string | undefined]>;
    links: SpecifierLinks;
    /** Exports that never hold a tracked value: see `summarizeModule`. */
    untrackedExports: NameList;
    /** The auto-imported names it may use: see `summarizeModule`. */
    globalNames: readonly string[];
  }>;
};

/** Where a module graph keeps its modules. */
export interface RecordStore {
  /** Whether `file` is one of the graph's modules, loaded or not. */
  has(file: string): boolean;
  get(file: string): ModuleRecord | undefined;
  /** True when the export is known to hold no tracked value, without loading the module. */
  isUntrackedExport(file: string, name: string): boolean;
  /** The records in memory. */
  loaded(): Iterable<ModuleRecord>;
  /** Every module's links, in loading order: a file's scripts after its module. */
  links(): Iterable<{ ref: ModuleRef; links: Links }>;
  /** The modules that may mention one of `names`; undefined if every module may. */
  mentioning(names: ReadonlySet<string>): readonly ModuleRef[] | undefined;
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

  isUntrackedExport(): boolean {
    return false;
  }

  mentioning(): undefined {
    return undefined;
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

export type IndexedRecordsOptions = {
  /** In loading order. */
  summaries: readonly ModuleSummary[];
  /** A module of `summaries`, parsed; undefined if it cannot be. */
  load(file: string): ParsedModule | undefined;
  /** Characters of code the loaded modules hold before the least recently read are unloaded. */
  budget: number;
};

type IndexedModule = {
  resolved: ReadonlyArray<Map<string, string | undefined>>;
  links: readonly Links[];
  untrackedExports: NameList | undefined;
};

/**
 * The modules of an index, each loaded when it is read. Once they hold more
 * than the budget, the least recently read are unloaded: an analysis can read
 * more modules than fit in memory, e.g. every module that renders a component.
 *
 * A module read again after it was unloaded is parsed again, while what read
 * it before may still use the first copy. What the analysis finds does not
 * depend on which copy it reads: what holds nodes of another module, as a
 * template does its component's class, holds that module, and a binding is
 * guarded against cycles by a key that is the same in every copy.
 */
export class IndexedRecords implements RecordStore {
  private readonly modules = new Map<string, IndexedModule>();
  /** Least recently read first. */
  private readonly records = new Map<string, ModuleRecord>();
  private readonly mentions = new Map<string, ModuleRef[]>();
  private size = 0;

  constructor(private readonly options: IndexedRecordsOptions) {
    for (const { file, parts } of options.summaries) {
      const resolved = parts.map((part) => new Map(part.resolved));

      this.modules.set(file, {
        resolved,
        links: parts.map((part, index) =>
          resolveLinks(part.links, resolved[index]!)
        ),
        untrackedExports: parts[0]?.untrackedExports,
      });

      parts.forEach(({ globalNames }, part) => {
        for (const name of globalNames) {
          const modules = this.mentions.get(name);
          if (modules) modules.push({ file, part });
          else this.mentions.set(name, [{ file, part }]);
        }
      });
    }
  }

  has(file: string): boolean {
    return this.modules.has(file);
  }

  get(file: string): ModuleRecord | undefined {
    const loaded = this.records.get(file);

    if (loaded) {
      this.records.delete(file);
      this.records.set(file, loaded);
      return loaded;
    }

    const module = this.modules.get(file);
    const parsed = module && this.options.load(file);
    if (!parsed) return undefined;

    const record = toRecord(file, parsed, module!.resolved);
    this.records.set(file, record);
    this.size += sizeOf(record);
    this.unloadOverBudget();

    return record;
  }

  isUntrackedExport(file: string, name: string): boolean {
    const untracked = this.modules.get(file)?.untrackedExports;

    return untracked !== undefined && hasName(untracked, name);
  }

  loaded(): Iterable<ModuleRecord> {
    return this.records.values();
  }

  *links(): Iterable<{ ref: ModuleRef; links: Links }> {
    for (const [file, { links }] of this.modules) {
      for (let part = 0; part < links.length; part++) {
        yield { ref: { file, part }, links: links[part]! };
      }
    }
  }

  mentioning(names: ReadonlySet<string>): readonly ModuleRef[] {
    return [...names].flatMap((name) => this.mentions.get(name) ?? []);
  }

  /** Keeps the module read last, whatever its size. */
  private unloadOverBudget(): void {
    for (const [file, record] of this.records) {
      if (this.size <= this.options.budget || this.records.size === 1) return;

      this.records.delete(file);
      this.size -= sizeOf(record);
    }
  }
}

/** Shaped as `ModuleGraph` links a module it reads. */
function toRecord(
  file: string,
  { scripts = [], ...module }: ParsedModule,
  resolved: IndexedModule['resolved']
): ModuleRecord {
  const record = linkPart(file, 0, module, resolved[0]!);
  if (scripts.length === 0) return record;

  return {
    ...record,
    scripts: scripts.map((script, index) =>
      linkPart(file, index + 1, script, resolved[index + 1] ?? new Map())
    ),
  };
}

function linkPart(
  file: string,
  part: number,
  module: Omit<ParsedModule, 'scripts'>,
  resolved: Map<string, string | undefined>
): ModuleRecord {
  return { file, part, ...module, resolved };
}

/**
 * The code each module of the file was parsed from: its syntax tree takes
 * about 40 times as much memory. A language's generated code is often several
 * times its file's size.
 */
function sizeOf(record: ModuleRecord): number {
  return modulesOf(record).reduce(
    (size, module) => size + parsedRange(module.program)[1],
    0
  );
}
