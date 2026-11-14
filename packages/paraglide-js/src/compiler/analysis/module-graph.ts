import { builtinModules } from 'node:module';
import { applyAliases, type ImportAlias } from '../bundler-configs/alias.js';
import { defaultLanguages } from '../languages/index.js';
import {
  detectedExtensions,
  extensionOf,
  languageExtensions,
  languageOf,
  NO_PACKAGES,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../languages/language.js';
import { runTooling } from '../languages/tooling.js';
import {
  isMessagesTarget,
  type ParaglideTarget,
  type SymbolSpec,
  type TargetFile,
} from '../paraglide/targets.js';
import { IGNORED_DIRECTORIES } from '../project/files.js';
import {
  nativeResolution,
  type NativeResolution,
} from '../resolver/node-resolver.js';
import { isScript } from '../utils/paths.js';
import { readTextFile } from '../utils/read-file.js';
import {
  native,
  type NativeAnalysis,
  type NativeGraph,
  type NativeLoadResult,
  type NativeMetadataResult,
  type NativeTarget,
} from './native.js';
import type { MetadataInput } from '../output/metadata.js';
import type { ParaglideUsage } from './types.js';

const CHANGED_DURING_ANALYSIS =
  'it changed while it was analyzed; run again for its usages';

/** Resolves an import like the project's bundler would: a file, or nothing. */
type Resolve = (
  specifier: string,
  importer: string
) => Promise<string | undefined>;

/** A name every module can use without importing it, e.g. from unplugin-auto-import. */
export type GlobalBinding = {
  name: string;
  /** Absolute. */
  file: string;
  /** "*" for the module namespace. */
  exportName: string;
};

export type ModuleGraphOptions = {
  targets: readonly ParaglideTarget[];
  languages: readonly SourceLanguage[];
  /** What the languages load their tooling from. Default: nothing is installed. */
  packages?: LanguageContext;
  /** The file an import resolves to; nothing if it is not a file, or not found. */
  resolve: Resolve;
  /**
   * The resolver `resolve` asks. If `nodeResolver` or `ProjectResolver` made
   * it, neither is called: the analysis resolves like it by itself, off the
   * main thread, never resolves a builtin, and tells `onUnresolved` of each
   * import that does not resolve.
   */
  resolver?: Resolve;
  onUnresolved?(specifier: string, importer: string): void;
  /** Known Paraglide outdirs, absolute. */
  outdirs?: readonly string[];
  /** Verifies that a directory imports reach is a Paraglide outdir. */
  isOutdir?(directory: string): Promise<boolean>;
  /** Reads every file. Default: the file system; scripts are read off the main thread. */
  read?(file: string): Promise<string | undefined>;
  /** Told of each file that is read but not analyzed. */
  onSkipped?(file: string, failure: ParseFailure): void;
};

/** The usages of a file that has any. The analysis keeps them, and the file's code, for `writeMetadata`. */
/** Its `usages` are read from the analysis each time they are asked for. */
export type AnalyzedFile = {
  readonly usages: ParaglideUsage[];
  /** How many usages it has. */
  readonly count: number;
  /** What its usages are of, once each: far fewer than its usages. */
  readonly keys: UsageKey[];
};

/** What usages have in common: all of a file's that share one are in or not in a catalog alike. */
export type UsageKey = Pick<
  ParaglideUsage,
  'target' | 'targetFile' | 'name' | 'dynamic'
>;

/** A file's usage keys from their JSON, `[target, targetFile, name, dynamic]`. */
function parseKeys(json: string, paths: readonly string[]): UsageKey[] {
  const keys = JSON.parse(json) as Array<[string, number, string, boolean]>;

  return keys.map(([target, targetFile, name, dynamic]) => ({
    target,
    targetFile: paths[targetFile]!,
    name,
    dynamic,
  }));
}

/** The usages of one file's JSON, with their target's file named. */
function parseUsages(json: string, paths: readonly string[]): ParaglideUsage[] {
  const usages = JSON.parse(json) as ReportedUsage[];
  for (const usage of usages) {
    (usage as unknown as ParaglideUsage).targetFile = paths[usage.targetFile]!;
  }

  return usages as unknown as ParaglideUsage[];
}

/** A usage as the analysis reports it: its target's file is named by index. */
type ReportedUsage = Omit<ParaglideUsage, 'targetFile'> & {
  targetFile: number;
};

/**
 * The project's modules, linked by resolved imports, and the usages in them.
 * The analysis is native code (`native/`), which also reads the built-in
 * languages' files; this gives it what only JavaScript has: what a language
 * of the caller's writes for a file, what a custom target matches and exports,
 * and what a custom resolver resolves.
 */
export class ModuleGraph {
  private readonly options: ModuleGraphOptions;
  private readonly graph: NativeGraph;
  private readonly customTargets: readonly ParaglideTarget[];
  private readonly resolution: NativeResolution | undefined;
  /** Set when the analysis resolves but JavaScript's aliases are regular expressions. */
  private aliases: readonly ImportAlias[] | undefined;

  /** The position of each file among those that were asked for, which orders the modules. */
  private readonly orders = new Map<string, number>();
  private aliasQueries: string[] = [];
  private readonly targetFiles = new Map<string, TargetFile>();
  /** The languages whose files the analysis writes itself. */
  private readonly nativeLanguages: ReadonlySet<SourceLanguage>;

  private constructor(
    options: ModuleGraphOptions,
    graph: NativeGraph,
    resolution: NativeResolution | undefined,
    aliases: readonly ImportAlias[] | undefined
  ) {
    this.options = options;
    this.graph = graph;
    this.resolution = resolution;
    this.aliases = aliases;
    this.customTargets = options.targets.filter(
      (target) => !isMessagesTarget(target)
    );
    this.nativeLanguages = new Set(nativeLanguagesOf(options.languages));
  }

  static async create(options: ModuleGraphOptions): Promise<ModuleGraph> {
    const resolution = options.resolver && nativeResolution(options.resolver);
    const resolver = await resolution?.options();
    const hasPatterns =
      resolver?.aliases.some((alias) => alias.find instanceof RegExp) ?? false;

    const nativeLanguages = nativeLanguagesOf(options.languages);
    const graph = new native.NativeGraph({
      targets: options.targets.map(nativeTarget),
      outdirs: [...(options.outdirs ?? [])],
      sourceExtensions: languageExtensions(options.languages),
      nativeLanguages: nativeLanguages.map((language) => language.name),
      // With `read`, JavaScript reads every file, and asks `detect` itself.
      detect: options.read
        ? []
        : detectedExtensions(
            options.languages.filter(
              (language) => !nativeLanguages.includes(language)
            )
          ),
      // A file is read again when its lines are needed, unless the caller reads them.
      sourcesOnDisk: !options.read,
      resolver: resolver && {
        aliases: hasPatterns
          ? []
          : resolver.aliases.map(({ find, replacement, exact }) => ({
              find: String(find),
              replacement,
              exact,
            })),
        rootDirectory: resolver.rootDirectory,
        conditions: [...resolver.conditions],
        builtins: [...builtinModules],
        aliasesInJs: hasPatterns,
        ignoredDirectories: [...IGNORED_DIRECTORIES],
      },
    });

    return new ModuleGraph(
      options,
      graph,
      resolution,
      hasPatterns ? resolver?.aliases : undefined
    );
  }

  /**
   * Starts reading and parsing `files` that are about to be loaded, while
   * JavaScript does something else, e.g. lists the other files. Only scripts
   * the analysis reads itself, outside the outdirs known now.
   */
  prefetch(files: readonly string[]): void {
    if (this.options.read) return;

    const scripts = files.filter(
      (file) => this.isReadNatively(file) && !this.orders.has(file)
    );
    if (scripts.length === 0) return;

    this.graph.prefetch(this.graph.notGenerated(scripts));
  }

  /** Longest first, so that a nested outdir wins over its parent. */
  get outdirs(): readonly string[] {
    return this.graph.outdirs();
  }

  /** The files that are not in an outdir. */
  notGenerated(files: readonly string[]): string[] {
    return this.graph.notGenerated([...files]);
  }

  setGlobals(globals: readonly GlobalBinding[]): void {
    this.graph.setGlobals([...globals]);
  }

  /** Verifies the outdirs that `files` may belong to. */
  async detectOutdirs(files: readonly string[]): Promise<void> {
    const { isOutdir } = this.options;
    if (!isOutdir) return;

    const candidates = this.graph.outdirCandidates([...files]);
    if (candidates.length === 0) return;

    const verdicts = await Promise.all(candidates.map(isOutdir));

    candidates.forEach((directory, index) => {
      if (!verdicts[index]) return;

      this.graph.addOutdir(directory);
      // What a file is to a target depends on the outdir it is in.
      this.targetFiles.clear();
    });
  }

  /** The name of the target each file belongs to. */
  targetsOf(files: readonly string[]): Array<string | undefined> {
    this.matchCustomTargets(files);

    return files.map((file) => this.graph.targetOf(file) ?? undefined);
  }

  /**
   * Loads `entries` and every module reachable from them. One walk for all of
   * them: a module that several entries reach is visited once.
   */
  async loadPaths(entries: readonly string[]): Promise<void> {
    const visited = new Set<string>();
    let frontier = [...new Set(entries)];

    while (frontier.length > 0) {
      for (const file of frontier) visited.add(file);

      await this.load(frontier);
      const dependencies = this.graph.dependencies(frontier);

      // Outdirs must be known before deciding what is a target.
      await this.detectOutdirs(dependencies);
      this.matchCustomTargets(dependencies);

      const unvisited = dependencies.filter((file) => !visited.has(file));
      frontier = this.graph.followable(unvisited);
    }
  }

  /** The usages in each of `files` that has any. They were loaded with `loadPaths`. */
  async analyze(files: readonly string[]): Promise<Map<string, AnalyzedFile>> {
    this.matchCustomTargets([]);

    const analysis =
      this.customTargets.length > 0
        ? this.graph.analyzeWithCustomTargets([...files], (...query) =>
            this.customSymbol(...query)
          )
        : await this.graph.analyze([...files]);

    return this.analyzedFiles(analysis);
  }

  private analyzedFiles(analysis: NativeAnalysis): Map<string, AnalyzedFile> {
    const { paths } = analysis;
    const analyzed = new Map<string, AnalyzedFile>();

    for (const file of analysis.changed) {
      this.options.onSkipped?.(file, { error: CHANGED_DURING_ANALYSIS });
    }

    const { graph } = this;
    analysis.files.forEach((file, index) => {
      const keys = analysis.keys[index]!;
      // Read when asked for, one file at a time: a project's usages are millions.
      analyzed.set(file, {
        get usages() {
          return parseUsages(graph.usagesOf(file) ?? '[]', paths);
        },
        count: analysis.counts[index]!,
        get keys() {
          return parseKeys(keys, paths);
        },
      });
    });

    return analyzed;
  }

  /**
   * Gives back the memory the modules take: after the analysis, only what the
   * metadata files are written from is needed. The graph is then as new, with
   * the same targets and outdirs.
   */
  release(): void {
    this.graph.release();
  }

  /**
   * Writes the metadata files of `input`'s projects, from the code and usages
   * of the files that were analyzed. See `MetadataFiles`.
   */
  writeMetadata(
    input: MetadataInput,
    radius: number
  ): Promise<NativeMetadataResult> {
    return this.graph.writeMetadata(JSON.stringify(input), radius);
  }

  // ---------------------------------------------------------------- loading

  /** Reads and parses the files that are not loaded yet, and resolves what they load. */
  private async load(frontier: readonly string[]): Promise<void> {
    const scripts: string[] = [];
    const others: string[] = [];

    for (const file of frontier) {
      if (this.orders.has(file)) continue;
      this.orders.set(file, this.orders.size);

      const readsHere =
        this.options.read !== undefined || !this.isReadNatively(file);
      (readsHere ? others : scripts).push(file);
    }

    await this.queueAll(others);
    const loaded = await this.graph.load(scripts, this.ordersOf(scripts));
    this.report(loaded);

    // The scripts a language may claim, e.g. Angular components in `.ts` files.
    if (loaded.needsJs.length > 0) {
      await this.queueAll(loaded.needsJs);
      this.report(await this.graph.load([], []));
    }

    await this.link();
  }

  /**
   * Whether the analysis reads `file` itself: a script, unless a language of
   * JavaScript's claims it, or a file whose language it writes itself.
   */
  private isReadNatively(file: string): boolean {
    if (isScript(file)) return true;

    const language = this.options.languages.find(
      (candidate) => extensionOf(file, candidate) !== undefined
    );

    return language !== undefined && this.nativeLanguages.has(language);
  }

  private ordersOf(files: readonly string[]): number[] {
    return files.map((file) => this.orders.get(file)!);
  }

  /**
   * Reads `files` here, and hands each to the analysis, as a language of the
   * caller's writes it if one claims it. The files that are skipped are
   * reported in their order, whichever is done first.
   */
  private async queueAll(files: readonly string[]): Promise<void> {
    const failures = await Promise.all(files.map((file) => this.queue(file)));

    files.forEach((file, index) => {
      const failure = failures[index];
      if (failure) this.options.onSkipped?.(file, failure);
    });
  }

  /** Reads a file, and queues it. Returns why it is skipped, if it is. */
  private async queue(file: string): Promise<ParseFailure | undefined> {
    const {
      languages,
      packages = NO_PACKAGES,
      read = readTextFile,
    } = this.options;
    const order = this.orders.get(file)!;

    const code = await read(file);
    if (code === undefined) return undefined;

    const language = languageOf(file, code, languages);
    if (language === undefined || this.nativeLanguages.has(language)) {
      // The analysis writes the file, or it is a script or a file that is not analyzed.
      if (language || isScript(file)) {
        this.graph.queueSource(file, order, code);
      } else {
        this.graph.queueEmpty(file, order, code);
      }
      return undefined;
    }

    // A language of the caller's.
    const result = await runTooling(file, code, languages, packages);

    switch (result.type) {
      case 'unclaimed':
        if (isScript(file)) this.graph.queueScript(file, order, code);
        else this.graph.queueEmpty(file, order, code);
        return undefined;
      case 'failed':
        return result.failure;
      case 'generated':
        this.graph.queueGenerated(file, order, code, result.source);
        return undefined;
    }
  }

  private report(loaded: NativeLoadResult): void {
    for (const { file, error } of loaded.skipped) {
      this.options.onSkipped?.(file, { error });
    }

    this.aliasQueries.push(...loaded.aliasQueries);
  }

  /** Resolves what the loaded modules load. */
  private async link(): Promise<void> {
    if (this.resolution) {
      const queries = this.aliasQueries;
      this.aliasQueries = [];
      const aliases = this.aliases ?? [];
      const aliased = queries.map((query) => applyAliases(query, aliases));

      const unresolved = await this.graph.resolve(queries, aliased);

      for (let index = 0; index < unresolved.length; index += 2) {
        const specifier = unresolved[index]!;
        const importer = unresolved[index + 1]!;

        this.resolution.unresolved?.(specifier, importer);
        this.options.onUnresolved?.(specifier, importer);
      }

      return;
    }

    const { importers, counts, specifiers } = this.graph.pendingSpecifiers();
    const resolving: Array<Promise<string | undefined>> = [];
    let next = 0;

    importers.forEach((importer, index) => {
      for (const specifier of specifiers.slice(next, next + counts[index]!)) {
        resolving.push(this.options.resolve(specifier, importer));
      }
      next += counts[index]!;
    });

    this.graph.setResolved(await Promise.all(resolving));
  }

  // ---------------------------------------------------------------- custom targets

  /** Asks the targets defined in JavaScript which of the files that imports reach are theirs. */
  private matchCustomTargets(files: readonly string[]): void {
    if (this.customTargets.length === 0) return;

    const { targets } = this.options;
    const queries = this.graph.customTargetQueries([...files]);
    if (queries.length === 0) return;

    const matches = queries.map((query) => {
      const file: TargetFile = {
        file: query.file,
        outdir: query.outdir ?? undefined,
        outdirPath: query.outdirPath ?? undefined,
      };
      this.targetFiles.set(query.path, file);

      // The last one, so that `[...defaultTargets, custom]` overrides a built-in target.
      return targets.findLastIndex(
        (target) => !isMessagesTarget(target) && target.matches(file)
      );
    });

    this.graph.setCustomMatches(
      queries.map((query) => query.path),
      matches
    );
  }

  /** What a custom target says an export of its file, or a member along `path` of it, is. */
  private customSymbol(
    target: number,
    file: string,
    exportName: string,
    path: readonly string[]
  ): { kind: string; name?: string; methods?: string[] } | undefined {
    const targetFile = this.targetFiles.get(file);
    if (!targetFile) return undefined;

    let spec: SymbolSpec | undefined = this.options.targets[
      target
    ]?.exportSymbol(exportName, targetFile);

    for (const name of path) {
      spec = spec?.type === 'namespace' ? spec.member(name) : undefined;
    }

    if (!spec) return undefined;
    if (spec.type === 'namespace') return { kind: 'namespace' };

    return {
      kind: 'value',
      name: spec.name,
      methods: [...(spec.methods ?? [])],
    };
  }
}

/**
 * The built-in languages of `languages` whose files the analysis writes
 * itself, rather than their tooling in JavaScript: each one that no language of
 * the caller's comes before with one of its extensions.
 */
function nativeLanguagesOf(
  languages: readonly SourceLanguage[]
): SourceLanguage[] {
  const written = new Set(native.nativeLanguages());

  return languages.filter((language, index) => {
    const isBuiltIn =
      defaultLanguages.includes(language) && written.has(language.name);
    if (!isBuiltIn) return false;

    const isShadowed = languages
      .slice(0, index)
      .some(
        (earlier) =>
          !defaultLanguages.includes(earlier) &&
          earlier.extensions.some((extension) =>
            language.extensions.includes(extension)
          )
      );

    return !isShadowed;
  });
}

function nativeTarget(target: ParaglideTarget): NativeTarget {
  return {
    name: target.name,
    kind: isMessagesTarget(target) ? 'messages' : 'custom',
  };
}
