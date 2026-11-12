import fsp from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { analyzeModule } from '../analysis/analyze.js';
import {
  ModuleGraph,
  type GlobalBinding,
  type ParsedModule,
} from '../analysis/module-graph.js';
import type { ParaglideUsage } from '../analysis/types.js';
import {
  isSourceFile,
  parseSource,
  type LanguageContext,
  type ParseFailure,
  type ParseFunction,
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
import { parseCode } from '../utils/parse.js';
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

const parse: ParseFunction = (file, code, lang) =>
  parseCode(file, code, {
    lang,
    range: true,
    astType: 'ts',
  }) as unknown as ReturnType<ParseFunction>;

/** Analyzes the project's source files and writes their usages to the messages' metadata files. */
export class ContextCollector {
  private readonly settings: CollectorSettings;
  private readonly packages: LanguageContext;

  private readonly moduleGraph: ModuleGraph;
  private readonly outdirDetector: OutdirDetector;
  private readonly outdirProjects: OutdirProjects;
  private readonly output: MetadataFiles;

  /** The analyzed files, and how many usages each has. */
  private readonly analyzed = new Map<string, number>();
  private readonly catalogs = new Map<string, Catalog>();
  /** By message file, absolute. */
  private readonly messageOutdirs = new Map<string, string | undefined>();
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

    this.moduleGraph = new ModuleGraph({
      resolve: (specifier, importer) => this.resolve(specifier, importer),
      readModule: (file) => this.readModule(file),
      targets: settings.targets,
      outdirs: settings.outdirs,
      isOutdir: (directory) => this.isOutdir(directory),
      shouldFollow: (file) =>
        this.isAppSource(file) && !this.moduleGraph.isGenerated(file),
    });
  }

  /** Analyzes the files `include` selects. `write()` writes what they use. */
  async scanAll(): Promise<void> {
    const { files, missing, autoImportDeclarations } =
      await this.settings.selection.list();
    this.warnMissingIncludes(missing);

    // Outdirs inside `include` must be known before choosing the sources.
    await Promise.all(files.map((file) => this.moduleGraph.detectOutdir(file)));
    await this.loadGlobals(autoImportDeclarations);

    const sources = files.filter((file) => !this.moduleGraph.isGenerated(file));

    // Every source is loaded before any is analyzed: a value can flow from one
    // module into another's function, e.g. `show(m)` into `function show(t)`.
    await this.moduleGraph.loadPaths(sources);
    await this.loadCatalogs();

    for (const file of sources) this.analyzeLoaded(file);

    this.warnNoOutdir();
    await this.warnMissingTools();
    this.warnUnknownMessages();
    this.logSummary(sources.length);
  }

  async write(): Promise<void> {
    for (const { file, reason } of await this.output.write()) {
      this.warn(`${this.relative(file)} was not updated: ${reason}`);
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

  private async readModule(file: string): Promise<ParsedModule | undefined> {
    const code = await fsp.readFile(file, 'utf8').catch(() => undefined);
    if (code === undefined) return undefined;

    const parsed = await parseSource(
      file,
      code,
      parse,
      this.settings.languages,
      this.packages
    );
    if ('module' in parsed) return parsed.module;

    this.reportSkipped(file, parsed);

    return undefined;
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
    await this.moduleGraph.loadPaths(sources);

    this.moduleGraph.setGlobals(globals);
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

  private analyzeLoaded(file: string): void {
    const usages = analyzeModule(this.moduleGraph, file);

    this.tagInlangProjects(usages);
    this.checkCatalogs(file, usages);
    this.analyzed.set(file, usages.length);

    const record = this.moduleGraph.getRecord(file);
    if (!record || usages.length === 0) return;

    this.output.add(file, {
      file: this.relative(file),
      code: record.code,
      usages,
    });
  }

  /** Records on each message usage the inlang project its outdir is paired with. */
  private tagInlangProjects(usages: readonly ParaglideUsage[]): void {
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      if (!outdir) continue;

      const project = this.outdirProjects.of(outdir);
      if (!project) continue;

      usage.inlangProject = this.relative(project);
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
    const warning = unknownMessagesWarning(this.unknownMessages);
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
