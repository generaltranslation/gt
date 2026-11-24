import { parsedRange } from './ast.js';
import {
  linksOf,
  resolveLinks,
  type Links,
  type ModuleRef,
  type SpecifierLinks,
} from './importers.js';
import type { ModuleRecord, ParsedModule } from './module-graph.js';
import type { SitePositions } from './site-positions.js';
import {
  exportingStatements,
  hasEsmExports,
  starExportSpecifiers,
} from './module-syntax.js';
import {
  shareNameLists,
  SharedNames,
  type AnyNameList,
  type NameList,
  type SharedNameList,
} from '../utils/name-list.js';

/**
 * What the analysis knows of a module without its syntax tree. Its name lists
 * are strings, or places in a buffer threads share: see `forThreads`.
 */
export type ModuleSummary<Names extends AnyNameList = NameList> = {
  file: string;
  /** The file's module, then its scripts. */
  parts: ReadonlyArray<{
    /** The file each loaded specifier resolves to. */
    resolved: ReadonlyArray<readonly [string, string | undefined]>;
    links: SpecifierLinks;
    /** Exports that never hold a tracked value: see `summarizeModule`. */
    untrackedExports: Names;
    /**
     * The names it exports, `export *` aside, and the specifiers of its
     * `export *`. Unset when unknown: without ESM exports, the module may be
     * CommonJS.
     */
    exports?: { names: Names; stars: readonly string[] };
    /** The auto-imported names it may use: see `summarizeModule`. */
    globalNames: readonly string[];
    /** Unset when unknown: see `sitePositions`. */
    sites?: SitePositions | SharedSitesPlace;
  }>;
};

/** Where a module's `SitePositions` are in the buffer of `forThreads`, in numbers. */
export type SharedSitesPlace = { at: number; length: number };

/**
 * The names a module exports, `export *` aside, and the files of its
 * `export *`; unknown without ESM exports.
 */
export type ModuleExports =
  | { names: Iterable<string>; starExported: readonly string[] }
  | 'unknown';

/** Where a module graph keeps its modules. */
export interface RecordStore {
  /** Whether `file` is one of the graph's modules, loaded or not. */
  has(file: string): boolean;
  get(file: string): ModuleRecord | undefined;
  /** True when the export is known to hold no tracked value, without loading the module. */
  isUntrackedExport(file: string, name: string): boolean;
  /** Undefined if `file` is not one of the graph's modules, or cannot be read. */
  exportsOf(file: string): ModuleExports | undefined;
  /** The records in memory. */
  loaded(): Iterable<ModuleRecord>;
  /** Every module's links, in loading order: a file's scripts after its module. */
  links(): Iterable<{ ref: ModuleRef; links: Links }>;
  /** The modules that may mention one of `names`; undefined if every module may. */
  mentioning(names: ReadonlySet<string>): readonly ModuleRef[] | undefined;
  /** Where the module's sites are, if the index has them: see `sitePositions`. */
  sitePositions(ref: ModuleRef): SitePositions | undefined;
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

  exportsOf(file: string): ModuleExports | undefined {
    const record = this.records.get(file);
    if (!record) return undefined;
    if (!hasEsmExports(record.program)) return 'unknown';

    return {
      names: exportingStatements(record.program).keys(),
      starExported: resolvedFiles(
        starExportSpecifiers(record.program),
        record.resolved
      ),
    };
  }

  mentioning(): undefined {
    return undefined;
  }

  /** A loaded module is walked: it is in memory already. */
  sitePositions(): undefined {
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
  summaries: readonly ModuleSummary<AnyNameList>[];
  /** A module of `summaries`, parsed; undefined if it cannot be. */
  load(file: string): ParsedModule | undefined;
  /** Characters of code the loaded modules hold before the least recently read are unloaded. */
  budget: number;
  /** Where the summaries' shared name lists are: see `forThreads`. */
  names?: SharedNames;
  /** Where the summaries' shared site positions are: see `forThreads`. */
  sites?: Int32Array;
};

type IndexedModule = {
  resolved: ReadonlyArray<Map<string, string | undefined>>;
  links: readonly Links[];
  untrackedExports: AnyNameList | undefined;
  exports: { names: AnyNameList; starExported: readonly string[] } | undefined;
  sites: ReadonlyArray<SitePositions | SharedSitesPlace | undefined>;
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
  private readonly names: SharedNames;
  /** The record read last, which is last in `records`. */
  private lastRead: string | undefined;
  private size = 0;

  constructor(private readonly options: IndexedRecordsOptions) {
    this.names = options.names ?? new SharedNames(Buffer.alloc(0));
    for (const { file, parts } of options.summaries) {
      const resolved = parts.map((part) => new Map(part.resolved));

      this.modules.set(file, {
        resolved,
        links: parts.map((part, index) =>
          resolveLinks(part.links, resolved[index]!)
        ),
        untrackedExports: parts[0]?.untrackedExports,
        exports: indexedExports(parts[0]?.exports, resolved[0]),
        sites: parts.map((part) => part.sites),
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
      // A module is often read many times in a row: it stays where it is.
      if (file !== this.lastRead) {
        this.records.delete(file);
        this.records.set(file, loaded);
        this.lastRead = file;
      }

      return loaded;
    }

    const module = this.modules.get(file);
    const parsed = module && this.options.load(file);
    if (!parsed) return undefined;

    const record = toRecord(file, parsed, module!.resolved);
    this.records.set(file, record);
    this.lastRead = file;
    this.size += sizeOf(record);
    this.unloadOverBudget();

    return record;
  }

  isUntrackedExport(file: string, name: string): boolean {
    const untracked = this.modules.get(file)?.untrackedExports;

    return untracked !== undefined && this.names.has(untracked, name);
  }

  /** Read from the index: listing a module's exports parses none. */
  exportsOf(file: string): ModuleExports | undefined {
    const module = this.modules.get(file);
    if (!module) return undefined;

    const { exports } = module;
    if (!exports) return 'unknown';

    return {
      names: this.names.names(exports.names),
      starExported: exports.starExported,
    };
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

  sitePositions({ file, part }: ModuleRef): SitePositions | undefined {
    const sites = this.modules.get(file)?.sites[part];
    if (!sites || sites instanceof Int32Array) return sites;

    return this.options.sites?.subarray(sites.at, sites.at + sites.length);
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

/**
 * `summaries` as the threads read them: their name lists and site positions
 * in buffers they share (`IndexedRecordsOptions.names` and `.sites`), which
 * each reads instead of holding a copy. A large project's modules export
 * millions of names and have millions of calls.
 */
export function forThreads(summaries: readonly ModuleSummary[]): {
  summaries: ModuleSummary<SharedNameList>[];
  names: SharedArrayBuffer;
  sites: SharedArrayBuffer;
} {
  const lists = summaries.flatMap(({ parts }) =>
    parts.flatMap(({ untrackedExports, exports }) =>
      exports ? [untrackedExports, exports.names] : [untrackedExports]
    )
  );
  const { bytes: names, places } = shareNameLists(lists);

  let siteCount = 0;
  for (const { parts } of summaries) {
    for (const { sites } of parts) {
      if (sites instanceof Int32Array) siteCount += sites.length;
    }
  }

  const sites = new SharedArrayBuffer(siteCount * Int32Array.BYTES_PER_ELEMENT);
  const sharedSites = new Int32Array(sites);

  let nextList = 0;
  let nextSite = 0;
  const shared = summaries.map(({ file, parts }) => ({
    file,
    parts: parts.map(
      ({ untrackedExports: _, exports, sites: ownSites, ...part }) => {
        let sitesPlace = ownSites;

        if (ownSites instanceof Int32Array) {
          sharedSites.set(ownSites, nextSite);
          sitesPlace = { at: nextSite, length: ownSites.length };
          nextSite += ownSites.length;
        }

        return {
          ...part,
          untrackedExports: places[nextList++]!,
          ...(exports && {
            exports: { names: places[nextList++]!, stars: exports.stars },
          }),
          sites: sitesPlace,
        };
      }
    ),
  }));

  return { summaries: shared, names, sites };
}

function indexedExports(
  exports: ModuleSummary<AnyNameList>['parts'][number]['exports'],
  resolved: ReadonlyMap<string, string | undefined> | undefined
): IndexedModule['exports'] {
  return (
    exports && {
      names: exports.names,
      starExported: resolvedFiles(exports.stars, resolved ?? new Map()),
    }
  );
}

/** The files `specifiers` resolve to, without those that resolve to none. */
export function resolvedFiles(
  specifiers: readonly string[],
  resolved: ReadonlyMap<string, string | undefined>
): string[] {
  return specifiers.flatMap((specifier) => {
    const file = resolved.get(specifier);
    return file ? [file] : [];
  });
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
