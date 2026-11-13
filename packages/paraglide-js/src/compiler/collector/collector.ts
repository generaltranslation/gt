import { isBuiltin } from 'node:module';
import path from 'node:path';
import {
  ModuleGraph,
  type AnalyzedFile,
  type GlobalBinding,
} from '../analysis/module-graph.js';
import type { ParaglideUsage } from '../analysis/types.js';
import {
  isSourceFile,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../languages/language.js';
import { readCatalog } from '../paraglide/catalog.js';
import { OutdirDetector } from '../paraglide/outdir.js';
import type { ParaglideTarget } from '../paraglide/targets.js';
import {
  autoImportsFromOptions,
  detectAutoImports,
  type AutoImport,
  type AutoImportOptions,
} from '../project/auto-imports.js';
import type { FileSelection } from '../project/files.js';
import { projectPackages } from '../project/packages.js';
import { isDependency, isWithin, relativePath } from '../utils/paths.js';
import { isInCatalog, unknownMessagesWarning } from './catalog-check.js';
import { MetadataFiles } from './metadata-files.js';
import { MissingTools } from './missing-tools.js';
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

  /** Made for the scan: the resolver's config is read by then. */
  private moduleGraph: ModuleGraph | undefined;
  private readonly outdirDetector: OutdirDetector;
  private readonly outdirProjects: OutdirProjects;
  private readonly output: MetadataFiles;

  /** The analyzed files, and how many usages each has. */
  private readonly analyzed = new Map<string, number>();
  private readonly catalogs = new Map<string, Catalog>();
  /** By message file, absolute. */
  private readonly messageOutdirs = new Map<string, string | undefined>();
  /** The outdirs, longest first. */
  private knownOutdirs: readonly string[] = [];
  /** Usages of messages that are not in their catalog. */
  private readonly unknownMessages: string[] = [];
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
  }

  private createGraph(): Promise<ModuleGraph> {
    const { settings } = this;

    return ModuleGraph.create({
      targets: settings.targets,
      languages: settings.languages,
      packages: this.packages,
      resolver: settings.resolver,
      resolve: (specifier, importer) => this.resolve(specifier, importer),
      onUnresolved: (specifier, importer) =>
        this.warnUnresolvedParaglide(specifier, importer),
      outdirs: settings.outdirs,
      isOutdir: (directory) => this.isOutdir(directory),
      onSkipped: (file, failure) => this.reportSkipped(file, failure),
    });
  }

  /** Analyzes the files `include` selects. `write()` writes what they use. */
  async scanAll(): Promise<void> {
    const graph = (this.moduleGraph ??= await this.createGraph());

    const { files, missing, autoImportDeclarations } =
      await this.settings.selection.list({
        // Read and parsed while the others are listed.
        onFiles: (found) => graph.prefetch(found),
      });
    this.warnMissingIncludes(missing);

    // Outdirs inside `include` must be known before choosing the sources.
    await graph.detectOutdirs(files);
    await this.loadGlobals(graph, autoImportDeclarations);

    const sources = graph.notGenerated(files);

    // Every source is loaded before any is analyzed: a value can flow from one
    // module into another's function, e.g. `show(m)` into `function show(t)`.
    await graph.loadPaths(sources);
    await this.loadCatalogs(graph);

    const analyzed = await graph.analyze(sources);
    // The modules are not needed anymore: their memory is given back while the usages are recorded.
    graph.release();
    for (const file of sources) this.record(file, analyzed.get(file));

    this.warnNoOutdir();
    await this.warnMissingTools();
    this.warnUnknownMessages();
    this.logSummary(sources.length);
  }

  async write(): Promise<void> {
    // Without a scan, no project has metadata files.
    const graph = this.moduleGraph;
    if (!graph) return;

    const { skipped, changed } = await this.output.write(graph);
    for (const { file, reason } of skipped) {
      this.warn(`${this.relative(file)} was not updated: ${reason}`);
    }
    for (const file of changed) {
      this.warn(
        `${this.relative(file)} changed after it was analyzed; its snippets are left out until the next run`
      );
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
    graph: ModuleGraph,
    declarationFiles: readonly string[]
  ): Promise<void> {
    const globals = await this.autoImportedGlobals(declarationFiles);
    const modules = [...new Set(globals.map(({ file }) => file))];

    // Outdirs must be known before deciding what is a target.
    await graph.detectOutdirs(modules);

    const targets = graph.targetsOf(modules);
    const sources = modules.filter(
      (file, index) => !targets[index] && this.isAppSource(file)
    );
    await graph.loadPaths(sources);

    graph.setGlobals(globals);
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
  private async loadCatalogs(graph: ModuleGraph): Promise<void> {
    this.knownOutdirs = graph.outdirs;

    await Promise.all(
      this.knownOutdirs.map(async (outdir) => {
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

  /** Records the usages of an analyzed file, for the metadata files. */
  private record(file: string, analyzed: AnalyzedFile | undefined): void {
    const usages = analyzed?.usages ?? [];

    this.recordInlangProjects(usages);
    this.checkCatalogs(file, usages);
    this.analyzed.set(file, usages.length);

    if (!analyzed || usages.length === 0) return;

    // The analysis kept the usages, and the file's code.
    this.output.add(file);
  }

  /** Records the inlang project the outdir of each message usage is paired with: the usage counts for it. */
  private recordInlangProjects(usages: readonly ParaglideUsage[]): void {
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      if (!outdir) continue;

      const project = this.outdirProjects.of(outdir);
      if (!project) continue;

      this.output.addTarget(usage.targetFile, project);
    }
  }

  private checkCatalogs(file: string, usages: readonly ParaglideUsage[]): void {
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      const catalog = outdir && this.catalogs.get(outdir);
      if (!catalog || isInCatalog(usage, catalog)) continue;

      const position = `${this.relative(file)}:${usage.line}:${usage.column}`;
      this.unknownMessages.push(`${usage.name} (${position})`);
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
    return this.knownOutdirs.find((outdir) => isWithin(outdir, messageFile));
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
    if (this.knownOutdirs.length > 0) return;

    this.warn('no Paraglide outdir found; no usages can be recorded');
  }

  private async warnMissingTools(): Promise<void> {
    for (const warning of await this.missingTools.warnings()) {
      this.warn(warning);
    }
  }

  private warnUnknownMessages(): void {
    const warning = unknownMessagesWarning(this.unknownMessages);
    if (warning) this.warn(warning);
  }

  /** "12 usage(s) in 3 of 40 analyzed file(s); outdirs: src/paraglide" */
  private logSummary(sourceCount: number): void {
    const counts = this.usageCounts();
    const usages = counts.reduce((sum, count) => sum + count, 0);
    const outdirs = this.knownOutdirs
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
