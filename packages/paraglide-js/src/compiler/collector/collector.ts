import fsp from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { analyzeModule } from '../analysis/analyze.js';
import { ModuleGraph, type GlobalBinding } from '../analysis/module-graph.js';
import { ModuleIndexer, type ParsedSummary } from '../analysis/module-index.js';
import type { ParaglideUsage } from '../analysis/types.js';
import { defaultLanguages } from '../languages/index.js';
import {
  isSourceFile,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../languages/language.js';
import { readCatalog } from '../paraglide/catalog.js';
import { OutdirDetector } from '../paraglide/outdir.js';
import { defaultTargets, type ParaglideTarget } from '../paraglide/targets.js';
import {
  autoImportsFromOptions,
  detectAutoImports,
  type AutoImport,
  type AutoImportOptions,
} from '../project/auto-imports.js';
import type { FileSelection } from '../project/files.js';
import { projectPackages } from '../project/packages.js';
import { isDependency, isWithin, relativePath } from '../utils/paths.js';
import { readTextFile } from '../utils/read-file.js';
import { SpilledBytes } from '../utils/spill-file.js';
import {
  AnalysisPool,
  analysisThreads,
  threadBudget,
} from './analysis-pool.js';
import { isInCatalog, unknownMessagesWarning } from './catalog-check.js';
import { MetadataFiles } from './metadata-files.js';
import { MissingTools } from './missing-tools.js';
import {
  analysisBudget,
  THREAD_HEAP_SHARE,
  loadIndexedFile,
  summarizeFile,
  type SummaryResult,
} from './module-reader.js';
import { OutdirProjects } from './outdir-projects.js';

/** Resolves an import like the project's bundler would: a file, or nothing. */
export type Resolver = (
  specifier: string,
  importer: string
) => Promise<string | undefined>;

export type CollectorLogger = {
  warn(message: string): void;
  info(message: string): void;
};

/** Starts every logged message. */
export const LOG_PREFIX = '[paraglide-context]';

export type CollectorSettings = {
  /** Usages are reported relative to it. */
  projectRoot: string;
  logger: CollectorLogger;
  resolver: Resolver;
  selection: FileSelection;
  /** Whether `include` was configured, so that missing entries are worth a warning. */
  explicitInclude: boolean;
  /** Absolute inlang project directories; undefined to detect them. */
  inlangProjects: readonly string[] | undefined;
  /** Where `*.inlang` directories are looked for, nearest first. */
  inlangSearchDirectories: readonly string[];
  radius: number;
  targets: readonly ParaglideTarget[];
  languages: readonly SourceLanguage[];
  /** Outdirs that are used without verification, absolute. */
  outdirs: readonly string[];
  /** `false` disables auto-imports, including their detection. */
  autoImports: false | AutoImportOptions | undefined;
  /** Where else to look for `@inlang/paraglide-js`, e.g. the project and workspace roots. */
  fallbackDirectories: readonly string[];
};

/** An outdir's message ids; undefined if they cannot be read. */
type Catalog = Set<string> | undefined;

/** `./paraglide/messages.js`, `$lib/paraglide/runtime` */
const IN_PARAGLIDE_DIRECTORY = /(^|[/\\])paraglide[/\\]/;

/** Analyzes the project's source files and writes their usages to the messages' metadata files. */
export class ContextCollector {
  private readonly settings: CollectorSettings;
  private readonly packages: LanguageContext;

  /** Finds outdirs and targets; the modules are indexed by `indexer`. */
  private readonly moduleGraph: ModuleGraph;
  private readonly indexer: ModuleIndexer;
  /** What languages generated for the indexed files, when this thread analyzes them: it parses a file again when it loads it. */
  private readonly generated = new SpilledBytes();
  private globals: readonly GlobalBinding[] = [];
  private globalNames: ReadonlySet<string> = new Set();
  private pool: AnalysisPool | undefined;
  /** See `analysisBudget`; set by `scanAll`. */
  private budget = 0;
  private averageFileSize = 0;
  private readonly outdirDetector: OutdirDetector;
  private readonly outdirProjects: OutdirProjects;
  private readonly output: MetadataFiles;

  /** The analyzed files, and how many usages each has. */
  private readonly analyzed = new Map<string, number>();
  private readonly catalogs = new Map<string, Catalog>();
  /** By message file, absolute. */
  private readonly messageOutdirs = new Map<string, string | undefined>();
  /** By absolute directory: a project has many usages. */
  private readonly relativeProjects = new Map<string, string>();
  /** Usages of messages that are not in their catalog, by file: files are analyzed in any order. */
  private readonly unknownMessages = new Map<string, string[]>();
  /** The analyzed files, in the order their warnings are listed. */
  private sources: readonly string[] = [];
  private readonly missingTools: MissingTools;
  /** Warnings are logged once. */
  private readonly warned = new Set<string>();

  constructor(settings: CollectorSettings) {
    const { projectRoot, languages } = settings;

    this.settings = settings;
    this.packages = projectPackages(projectRoot);
    this.output = new MetadataFiles(projectRoot, settings.radius);
    this.missingTools = new MissingTools({
      projectRoot,
      languages,
      packages: this.packages,
    });

    this.outdirProjects = new OutdirProjects({
      configured: settings.inlangProjects,
      searchDirectories: settings.inlangSearchDirectories,
    });
    this.outdirDetector = new OutdirDetector({
      fallbackDirectories: settings.fallbackDirectories,
    });

    this.moduleGraph = new ModuleGraph({
      resolve: (specifier, importer) => this.resolve(specifier, importer),
      readModule: () => {
        throw new Error('The collector indexes its modules.');
      },
      targets: settings.targets,
      outdirs: settings.outdirs,
      isOutdir: (directory) => this.isOutdir(directory),
      shouldFollow: (file) =>
        this.isAppSource(file) && !this.moduleGraph.isGenerated(file),
    });
    this.indexer = new ModuleIndexer({
      graph: this.moduleGraph,
      resolve: (specifier, importer) => this.resolve(specifier, importer),
      summarize: (file) => this.summarize(file),
    });
  }

  /** Analyzes the files `include` selects. `write()` writes what they use. */
  async scanAll(): Promise<void> {
    const { files, missing, autoImportDeclarations } =
      await this.settings.selection.list();
    this.warnMissingIncludes(missing);

    let sourceCount: number;

    const codeSize = await sizeOf(files);
    this.averageFileSize = codeSize / Math.max(1, files.length);
    this.pool = this.startThreads(codeSize);
    this.budget = this.pool
      ? threadBudget(this.averageFileSize)
      : analysisBudget(this.averageFileSize);
    try {
      sourceCount = await this.scan(files, autoImportDeclarations);
    } finally {
      await this.pool?.close();
      this.pool = undefined;
      this.generated.close();
    }

    this.warnNoOutdir();
    await this.warnMissingTools();
    this.warnUnknownMessages();
    this.logSummary(sourceCount);
  }

  /** Returns how many source files it analyzed. */
  private async scan(
    files: readonly string[],
    autoImportDeclarations: readonly string[]
  ): Promise<number> {
    // Outdirs inside `include` must be known before choosing the sources.
    await Promise.all(files.map((file) => this.moduleGraph.detectOutdir(file)));
    await this.loadGlobals(autoImportDeclarations);

    const sources = files.filter((file) => !this.moduleGraph.isGenerated(file));

    // Every source is indexed before any is analyzed: a value can flow from one
    // module into another's function, e.g. `show(m)` into `function show(t)`.
    await this.indexer.indexPaths(sources);
    await this.loadCatalogs();

    this.sources = sources;
    await this.analyzeAll(sources);

    return sources.length;
  }

  /** Threads that analyze the files, if the project is large enough, and its languages and targets can be given to them. */
  private startThreads(codeSize: number): AnalysisPool | undefined {
    const { languages, targets, projectRoot } = this.settings;
    const isDefault =
      languages === defaultLanguages && targets === defaultTargets;
    if (!isDefault) return undefined;

    const threads = analysisThreads(codeSize);

    return threads > 0 ? new AnalysisPool(threads, projectRoot) : undefined;
  }

  /**
   * Analyzes each file through an index of the modules, which loads a module
   * when it is read. Records the usages of each file as soon as they are
   * found: the code of every file does not fit in memory.
   */
  private async analyzeAll(sources: readonly string[]): Promise<void> {
    const index = {
      summaries: this.indexer.modules,
      outdirs: this.moduleGraph.outdirs,
      globals: this.globals,
      budget: this.budget,
    };

    if (this.pool) {
      // The threads do not hold the files' code: it is read again.
      await this.pool.analyze(index, sources, async (file, usages) => {
        const code = usages.length > 0 ? await readTextFile(file) : undefined;
        this.addUsages(file, usages, code);
      });
      return;
    }

    const graph = new ModuleGraph({
      targets: this.settings.targets,
      outdirs: index.outdirs,
      globals: index.globals,
      index: {
        summaries: index.summaries,
        // This thread also holds the source code around every usage.
        budget: Math.min(
          index.budget,
          analysisBudget(this.averageFileSize, THREAD_HEAP_SHARE / 2)
        ),
        load: (file) => loadIndexedFile(file, this.generated.get(file)),
      },
    });

    for (const file of sources) {
      // Held for its code: the analysis may unload it.
      const record = graph.getRecord(file);
      const usages = analyzeModule(graph, file);

      this.addUsages(file, usages, record?.code);
    }
  }

  /** Writes the metadata files, once: the source code kept for them is deleted. */
  async write(): Promise<void> {
    try {
      for (const { file, reason } of await this.output.write()) {
        this.warn(`${this.relative(file)} was not updated: ${reason}`);
      }
    } finally {
      this.output.close();
    }
  }

  /** The file an import resolves to; undefined if it is not a file, or not found. */
  private async resolve(
    specifier: string,
    importer: string
  ): Promise<string | undefined> {
    // Builtins are never Paraglide.
    if (isBuiltin(specifier)) return undefined;

    const id = await this.settings
      .resolver(specifier, importer)
      .catch(() => undefined);
    if (!id) {
      this.warnUnresolvedParaglide(specifier, importer);
      return undefined;
    }

    // A resolver may answer with something that is not a file, e.g. a virtual module.
    const [file = ''] = id.split('?', 1);

    return path.isAbsolute(file) ? path.normalize(file) : undefined;
  }

  /** What a file loads, for the index. */
  private async summarize(file: string): Promise<ParsedSummary | undefined> {
    const result: SummaryResult = this.pool
      ? await this.pool.summarize(file)
      : await summarizeFile(
          file,
          this.settings.languages,
          this.packages,
          this.globalNames
        );
    if (!result) return undefined;

    if ('failure' in result) {
      this.reportSkipped(file, result.failure);
      return undefined;
    }

    if (result.generated && !this.pool) {
      this.generated.set(file, result.generated);
    }

    return result.summary;
  }

  private reportSkipped(file: string, failure: ParseFailure): void {
    const { language, missing: requires, reason } = failure;

    // Unavailable tools get one warning per language, after the scan.
    if (language && requires) {
      this.missingTools.add(file, { language, requires, reason });
      return;
    }

    this.warn(`skipped ${this.relative(file)}: ${failure.error}`);
  }

  private async isOutdir(directory: string): Promise<boolean> {
    if (this.settings.outdirs.includes(directory)) return true;

    const verdict = await this.outdirDetector.check(directory);

    if (!verdict.outdir && verdict.reason) {
      this.warn(
        `${this.relative(directory)} is not used as a Paraglide outdir: ${verdict.reason}. ` +
          'If it is one, add it to the `outdirs` option.'
      );
    }

    return verdict.outdir;
  }

  /** A file of the app, not of a dependency, in a format that is analyzed. */
  private isAppSource(file: string): boolean {
    return isSourceFile(file, this.settings.languages) && !isDependency(file);
  }

  /** Makes auto-imported names visible in every module. */
  private async loadGlobals(
    declarationFiles: readonly string[]
  ): Promise<void> {
    const globals = await this.autoImportedGlobals(declarationFiles);
    const modules = [...new Set(globals.map(({ file }) => file))];

    // Outdirs must be known before deciding what is a target.
    await Promise.all(
      modules.map((file) => this.moduleGraph.detectOutdir(file))
    );

    const sources = modules.filter(
      (file) => !this.moduleGraph.targetOf(file) && this.isAppSource(file)
    );

    // Known before any module is indexed: the index lists which modules use them.
    this.globals = globals;
    this.globalNames = new Set(globals.map(({ name }) => name));
    this.pool?.setGlobalNames(this.globalNames);

    await this.indexer.indexPaths(sources);
  }

  /** The auto-imports of the options, then the detected ones; none if they are disabled. */
  private async autoImportedGlobals(
    declarationFiles: readonly string[]
  ): Promise<GlobalBinding[]> {
    const { autoImports, projectRoot } = this.settings;
    if (autoImports === false) return [];

    const imports = [
      ...autoImportsFromOptions(autoImports ?? {}, projectRoot),
      ...(await detectAutoImports(projectRoot, declarationFiles)),
    ];
    const files = await this.resolveAutoImports(imports);

    return firstResolvedOfEachName(imports, files);
  }

  /** The file of each auto-import. Many names come from one module, e.g. `ref` and `computed` from "vue". */
  private resolveAutoImports(
    imports: readonly AutoImport[]
  ): Promise<Array<string | undefined>> {
    const resolved = new Map<string, Promise<string | undefined>>();

    const resolveOnce = ({ specifier, importer }: AutoImport) => {
      const key = `${importer}\0${specifier}`;
      let file = resolved.get(key);

      if (!file) {
        file = this.resolve(specifier, importer);
        resolved.set(key, file);
      }

      return file;
    };

    return Promise.all(imports.map(resolveOnce));
  }

  /** Reads the catalog of every known outdir, and pairs each outdir with its inlang project. */
  private async loadCatalogs(): Promise<void> {
    await Promise.all(
      this.moduleGraph.outdirs.map(async (outdir) => {
        const catalog = await readCatalog(outdir).catch(() => undefined);

        this.catalogs.set(outdir, catalog);
        await this.pairProject(outdir, catalog);
      })
    );
  }

  /** Pairs `outdir` with its inlang project, whose messages get metadata files. */
  private async pairProject(outdir: string, catalog: Catalog): Promise<void> {
    const project = await this.outdirProjects.pair(outdir, catalog);

    if (!project) {
      this.warn(
        `no inlang project found for ${this.relative(outdir)}; its messages get no metadata file. ` +
          'List its project in the `inlangProjects` option.'
      );
      return;
    }

    this.output.addProject(project);

    const hasMessageFiles = project.messageFiles.length > 0;
    if (hasMessageFiles) return;

    this.warn(
      `${this.relative(project.directory)} has no base-locale message files in the inlang message format ` +
        '(`plugin.inlang.messageFormat`); its messages get no metadata file'
    );
  }

  private addUsages(
    file: string,
    usages: ParaglideUsage[],
    code: string | undefined
  ): void {
    this.tagInlangProjects(usages);
    this.checkCatalogs(file, usages);
    this.analyzed.set(file, usages.length);
    if (usages.length === 0 || code === undefined) return;

    this.output.add({ file: this.relative(file), code, usages });
  }

  /** Records on each message usage the inlang project its outdir is paired with. */
  private tagInlangProjects(usages: readonly ParaglideUsage[]): void {
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      if (!outdir) continue;

      const project = this.outdirProjects.of(outdir);
      if (!project) continue;

      usage.inlangProject = this.relativeProject(project);
    }
  }

  private checkCatalogs(file: string, usages: readonly ParaglideUsage[]): void {
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      const catalog = outdir && this.catalogs.get(outdir);
      if (!catalog || isInCatalog(usage, catalog)) continue;

      const position = `${this.relative(file)}:${usage.line}:${usage.column}`;
      const unknown = this.unknownMessages.get(file);
      const description = `${usage.name} (${position})`;

      if (unknown) unknown.push(description);
      else this.unknownMessages.set(file, [description]);
    }
  }

  /** The outdir of the message a usage resolves to; undefined for other targets. */
  private messageOutdir(usage: ParaglideUsage): string | undefined {
    if (usage.target !== 'message') return undefined;

    const { targetFile } = usage;
    if (!this.messageOutdirs.has(targetFile)) {
      this.messageOutdirs.set(targetFile, this.outdirOf(targetFile));
    }

    return this.messageOutdirs.get(targetFile);
  }

  private outdirOf(messageFile: string): string | undefined {
    // The innermost one, if outdirs are nested.
    return this.moduleGraph.outdirs.find((outdir) =>
      isWithin(outdir, messageFile)
    );
  }

  private warnMissingIncludes(missing: readonly string[]): void {
    if (!this.settings.explicitInclude) return;

    for (const entry of missing) {
      this.warn(`include entry ${this.relative(entry)} does not exist`);
    }
  }

  private warnUnresolvedParaglide(specifier: string, importer: string): void {
    const mayBeParaglide =
      IN_PARAGLIDE_DIRECTORY.test(specifier) &&
      !specifier.startsWith('@inlang/');
    if (!mayBeParaglide) return;

    this.warn(
      `could not resolve "${specifier}" from ${this.relative(importer)}; usages through it are not recorded`
    );
  }

  private warnNoOutdir(): void {
    if (this.moduleGraph.outdirs.length > 0) return;

    this.warn('no Paraglide outdir found; no usages can be recorded');
  }

  private async warnMissingTools(): Promise<void> {
    for (const warning of await this.missingTools.warnings()) {
      this.warn(warning);
    }
  }

  private warnUnknownMessages(): void {
    const warning = unknownMessagesWarning(
      this.sources.flatMap((file) => this.unknownMessages.get(file) ?? [])
    );
    if (warning) this.warn(warning);
  }

  /** "12 usage(s) in 3 of 40 analyzed file(s); outdirs: src/paraglide" */
  private logSummary(sourceCount: number): void {
    const counts = this.usageCounts();
    const usages = counts.reduce((sum, count) => sum + count, 0);
    const outdirs = this.moduleGraph.outdirs
      .map((outdir) => this.relative(outdir))
      .join(', ');

    this.settings.logger.info(
      `${LOG_PREFIX} ${usages} usage(s) in ${counts.length} of ${sourceCount} analyzed file(s)` +
        (outdirs ? `; outdirs: ${outdirs}` : '')
    );
  }

  /** The number of usages of each analyzed file that has any. */
  private usageCounts(): number[] {
    return [...this.analyzed.values()].filter((count) => count > 0);
  }

  private warn(message: string): void {
    if (this.warned.has(message)) return;

    this.warned.add(message);
    this.settings.logger.warn(`${LOG_PREFIX} ${message}`);
  }

  private relativeProject(directory: string): string {
    let relative = this.relativeProjects.get(directory);

    if (relative === undefined) {
      relative = this.relative(directory);
      this.relativeProjects.set(directory, relative);
    }

    return relative;
  }

  private relative(file: string): string {
    return relativePath(this.settings.projectRoot, file);
  }
}

/**
 * Of several auto-imports of a name, the first declared one that resolves
 * counts, whichever was resolved first. `files[index]` is the file of
 * `imports[index]`.
 */
function firstResolvedOfEachName(
  imports: readonly AutoImport[],
  files: ReadonlyArray<string | undefined>
): GlobalBinding[] {
  const globals = new Map<string, GlobalBinding>();

  imports.forEach(({ name, exportName }, index) => {
    const file = files[index];
    if (!file || globals.has(name)) return;

    globals.set(name, { name, file, exportName });
  });

  return [...globals.values()];
}

/** The bytes of `files`; a file that cannot be read counts for none. */
async function sizeOf(files: readonly string[]): Promise<number> {
  const sizes = await Promise.all(
    files.map((file) =>
      fsp.stat(file).then(
        ({ size }) => size,
        () => 0
      )
    )
  );

  return sizes.reduce((sum, size) => sum + size, 0);
}
