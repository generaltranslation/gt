import { builtinModules } from 'node:module';
import { applyAliases, type ImportAlias } from '../bundler-configs/alias.js';
import {
  detectedExtensions,
  generateSource,
  languageExtensions,
  NO_PACKAGES,
  type GeneratedFile,
  type GeneratedScript,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../languages/language.js';
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
  type NativeGeneratedCode,
  type NativeGeneratedSource,
  type NativeGraph,
  type NativeLoadResult,
  type NativeTarget,
} from './native.js';
import type { ParaglideUsage } from './types.js';

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

/** The usages of a file that has any. */
export type AnalyzedFile = { code: string; usages: ParaglideUsage[] };

/** A usage as the analysis reports it: its target's file is named by index. */
type ReportedUsage = Omit<ParaglideUsage, 'targetFile'> & {
  targetFile: number;
};

/**
 * The project's modules, linked by resolved imports, and the usages in them.
 * The analysis is native code (`native/`); this gives it what only JavaScript
 * has: what a framework's tooling writes for a component file, what a custom
 * target matches and exports, and what a custom resolver resolves.
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
  }

  static async create(options: ModuleGraphOptions): Promise<ModuleGraph> {
    const resolution = options.resolver && nativeResolution(options.resolver);
    const resolver = await resolution?.options();
    const hasPatterns =
      resolver?.aliases.some((alias) => alias.find instanceof RegExp) ?? false;

    const graph = new native.NativeGraph({
      targets: options.targets.map(nativeTarget),
      outdirs: [...(options.outdirs ?? [])],
      sourceExtensions: languageExtensions(options.languages),
      // With `read`, JavaScript reads every file, and asks `detect` itself.
      detect: options.read ? [] : detectedExtensions(options.languages),
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
    const usagesByFile = JSON.parse(analysis.usages) as ReportedUsage[][];
    const analyzed = new Map<string, AnalyzedFile>();

    analysis.files.forEach((file, index) => {
      const usages = usagesByFile[index]!;

      // The same objects, with their target's file named.
      for (const usage of usages) {
        (usage as unknown as ParaglideUsage).targetFile =
          paths[usage.targetFile]!;
      }

      analyzed.set(file, {
        code: analysis.codes[index]!,
        usages: usages as unknown as ParaglideUsage[],
      });
    });

    return analyzed;
  }

  // ---------------------------------------------------------------- loading

  /** Reads and parses the files that are not loaded yet, and resolves what they load. */
  private async load(frontier: readonly string[]): Promise<void> {
    const scripts: string[] = [];
    const others: string[] = [];

    for (const file of frontier) {
      if (this.orders.has(file)) continue;
      this.orders.set(file, this.orders.size);

      const readsHere = this.options.read !== undefined || !isScript(file);
      (readsHere ? others : scripts).push(file);
    }

    await Promise.all(others.map((file) => this.queue(file)));
    const loaded = await this.graph.load(scripts, this.ordersOf(scripts));
    this.report(loaded);

    // The scripts a language may claim, e.g. Angular components in `.ts` files.
    if (loaded.needsJs.length > 0) {
      await Promise.all(loaded.needsJs.map((file) => this.queue(file)));
      this.report(await this.graph.load([], []));
    }

    await this.link();
  }

  private ordersOf(files: readonly string[]): number[] {
    return files.map((file) => this.orders.get(file)!);
  }

  /** Reads a file here, and hands it to the analysis as its language's tooling writes it. */
  private async queue(file: string): Promise<void> {
    const {
      languages,
      packages = NO_PACKAGES,
      read = readTextFile,
    } = this.options;
    const order = this.orders.get(file)!;

    const code = await read(file);
    if (code === undefined) return;

    const generated = await generateSource(file, code, languages, packages);

    if (!generated) {
      if (isScript(file)) this.graph.queueScript(file, order, code);
      else this.graph.queueEmpty(file, order, code);
      return;
    }

    if ('error' in generated) {
      this.options.onSkipped?.(file, generated);
      return;
    }

    this.graph.queueGenerated(file, order, code, nativeSource(generated));
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

function nativeTarget(target: ParaglideTarget): NativeTarget {
  return {
    name: target.name,
    kind: isMessagesTarget(target) ? 'messages' : 'custom',
  };
}

function nativeSource({
  language,
  generated,
}: GeneratedFile): NativeGeneratedSource {
  return {
    main: nativeCode(generated),
    scripts: (generated.scripts ?? []).map(nativeCode),
    language: language.name,
    componentFields: generated.componentFields?.map((fields) => ({
      specifier: fields.specifier,
      className: fields.className,
      start: fields.range?.start,
      end: fields.range?.end,
    })),
    scopeObjects: generated.scopeObjects && [...generated.scopeObjects],
    props: generated.props && {
      calls: generated.props.calls && [...generated.props.calls],
      members: generated.props.members && [...generated.props.members],
      variables: generated.props.variables && [...generated.props.variables],
      undeclared: generated.props.undeclared,
    },
    componentInstances: generated.componentInstances && {
      via: generated.componentInstances.via,
      path: [...generated.componentInstances.path],
    },
  };
}

function nativeCode({
  code,
  lang,
  mappings,
}: GeneratedScript): NativeGeneratedCode {
  const flat = new Int32Array(mappings.length * 4);

  mappings.forEach((mapping, index) => {
    flat[index * 4] = mapping.generated;
    flat[index * 4 + 1] = mapping.source;
    flat[index * 4 + 2] = mapping.length;
    flat[index * 4 + 3] = mapping.sourceLength ?? mapping.length;
  });

  return { code, lang, mappings: flat };
}
