import { isBuiltin } from 'node:module';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import { analyzeModule } from '../analysis/analyze.js';
import {
  ModuleGraph,
  type GlobalBinding,
  type ParsedModule,
} from '../analysis/module-graph.js';
import { matchesPattern, readCatalog } from '../paraglide/catalog.js';
import { OutdirDetector } from '../paraglide/outdir.js';
import { isDependency, isWithin, relativePath } from '../utils/paths.js';
import {
  isSourceFile,
  parseSource,
  type LanguageContext,
  type ParseFunction,
  type SourceLanguage,
} from '../languages/language.js';
import { OutdirProjects } from './outdir-projects.js';
import { MetadataFiles } from './metadata-files.js';
import { projectPackages } from '../project/packages.js';
import { addDevDependencyCommand } from '../project/package-manager.js';
import type { ParaglideTarget } from '../paraglide/targets.js';
import type { ParaglideUsage } from '../analysis/types.js';
import {
  autoImportsFromOptions,
  detectAutoImports,
  type AutoImport,
  type AutoImportOptions,
} from '../project/auto-imports.js';
import type { FileSelection } from '../project/files.js';

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

/** Dynamic names list at most this many matching messages. */
const MAX_MATCHES = 50;
/** The warning about messages not in the catalog lists at most this many. */
const MAX_LISTED = 10;

/** Projects and languages whose unavailable tools were warned about, in this process. */
const WARNED_LANGUAGES = new Set<string>();

const parse: ParseFunction = (file, code, lang) =>
  parseSync(file, code, {
    lang,
    range: true,
    astType: 'ts',
  }) as unknown as ReturnType<ParseFunction>;

/** Analyzes the project's source files and writes their usages to the messages' metadata files. */
export class ContextCollector {
  private readonly settings: CollectorSettings;
  private readonly moduleGraph: ModuleGraph;
  private readonly outDirDetector: OutdirDetector;
  private readonly warnedMessages = new Set<string>();
  private readonly output: MetadataFiles;
  private readonly outdirProjects: OutdirProjects;
  /** The files this collector analyzed, and how many usages each has. */
  private readonly analyzed = new Map<string, number>();
  /** Message ids by outdir; undefined if an outdir's catalog cannot be read. */
  private readonly catalogs = new Map<string, Set<string> | undefined>();
  /** Per analyzed file, its usages of messages that are not in the catalog. */
  private readonly unknownMessages = new Map<string, string[]>();
  private readonly packages: LanguageContext;
  /** The modules each analyzed file depends on. */
  private readonly dependencies = new Map<string, Set<string>>();
  /** Files `include` selects. */
  private included = new Set<string>();
  /** Auto-import declaration files and the modules their imports reach. */
  private globalDependencies = new Set<string>();
  /** Each file's last successful parse, used while it does not parse (mid-edit). */
  private readonly lastParsed = new Map<string, ParsedModule>();
  /** Files skipped because their language's tools are unavailable, by language. */
  private readonly missingTools = new Map<
    string,
    { requires: readonly string[]; reason?: string; files: Set<string> }
  >();

  constructor(settings: CollectorSettings) {
    this.settings = settings;
    this.output = new MetadataFiles(settings.projectRoot, settings.radius);
    this.outdirProjects = new OutdirProjects({
      configured: settings.inlangProjects,
      searchDirectories: settings.inlangSearchDirectories,
    });
    this.packages = projectPackages(settings.projectRoot);
    this.outDirDetector = new OutdirDetector({
      fallbackDirectories: settings.fallbackDirectories,
    });
    this.moduleGraph = new ModuleGraph({
      resolve: (specifier, importer) => this.resolve(specifier, importer),
      readModule: (file) => this.readModule(file),
      targets: settings.targets,
      outdirs: settings.outdirs,
      isOutdir: (directory) => this.isOutdir(directory),
      shouldFollow: (file) =>
        this.isSourceFile(file) &&
        !isDependency(file) &&
        !this.moduleGraph.isGenerated(file),
    });
  }

  async scanAll(): Promise<void> {
    this.moduleGraph.clear();
    this.missingTools.clear();
    this.outDirDetector.clear();
    this.dependencies.clear();
    const previous = new Set(this.analyzed.keys());
    this.analyzed.clear();
    this.catalogs.clear();
    this.outdirProjects.clear();
    this.unknownMessages.clear();
    const { files, missing, autoImportDeclarations } =
      await this.settings.selection.list();
    if (this.settings.explicitInclude) {
      for (const entry of missing)
        this.warn(`include entry ${this.relative(entry)} does not exist`);
    }
    this.included = new Set(files);
    // Outdirs inside `include` must be known before choosing the sources.
    await Promise.all(files.map((file) => this.moduleGraph.detectOutdir(file)));
    await this.loadGlobals(autoImportDeclarations);
    const sources = files.filter((file) => this.isSource(file));
    // Every source is loaded before any is analyzed: a value can flow from one
    // module into another's function, e.g. `show(m)` into `function show(t)`.
    await Promise.all(sources.map((file) => this.load(file)));
    await this.loadCatalogs();
    for (const file of sources) this.analyzeLoaded(file);
    for (const file of previous) {
      if (!this.analyzed.has(file)) this.output.set(file, undefined);
    }
    if (this.moduleGraph.outdirs.length === 0) {
      // Custom targets (components, packages) can still have usages.
      const recorded = [...this.analyzed.values()].some((count) => count > 0);
      this.warn(
        recorded
          ? 'no Paraglide outdir found; messages and runtime functions are not recorded, only other targets'
          : 'no Paraglide outdir found; no usages can be recorded'
      );
    }
    await this.warnMissingTools();
    this.warnUnknownMessages();
    const counts = [...this.analyzed.values()].filter((count) => count > 0);
    const usages = counts.reduce((sum, count) => sum + count, 0);
    const outdirs = this.moduleGraph.outdirs
      .map((outdir) => this.relative(outdir))
      .join(', ');
    this.settings.logger.info(
      `${LOG_PREFIX} ${usages} usage(s) in ${counts.length} of ${sources.length} analyzed file(s)` +
        (outdirs ? `; outdirs: ${outdirs}` : '')
    );
  }

  /** Re-analyzes `changed` and every file that depends on it. */
  async updateChangedFileFromPath(changed: string): Promise<void> {
    if (this.globalDependencies.has(changed)) return this.scanAll();
    // Paraglide recompiled: the catalog may have changed.
    const outdir = this.outdirOf(changed);
    if (outdir) return this.refreshCatalog(outdir);
    this.moduleGraph.invalidate(changed);
    const affected = new Set<string>();
    if (this.isSource(changed)) affected.add(changed);
    // Files whose analysis read `changed`, e.g. through a re-export.
    for (const [file, dependencies] of this.dependencies) {
      if (dependencies.has(changed)) affected.add(file);
    }
    // Files `changed` imports: it can pass them values, e.g. `show(m)`.
    for (const file of await this.load(changed)) {
      if (this.isSource(file)) affected.add(file);
    }
    for (const file of affected) await this.analyze(file);
  }

  /** Whether a change to `file` can change the output. */
  isWatched(file: string): boolean {
    return (
      this.isSourceFile(file) ||
      this.globalDependencies.has(file) ||
      // e.g. virtual-modules' `messages.virtual.d.ts`, which lists the messages.
      this.outdirOf(file) !== undefined
    );
  }

  async write(): Promise<void> {
    for (const { file, reason } of await this.output.write()) {
      this.warn(`${this.relative(file)} was not updated: ${reason}`);
    }
  }

  private isSourceFile(file: string): boolean {
    return isSourceFile(file, this.settings.languages);
  }

  private async analyze(file: string): Promise<void> {
    await this.load(file);
    await this.loadCatalogs();
    this.analyzeLoaded(file);
  }

  /** Loads `file` and the modules it reaches. Returns them. */
  private async load(file: string): Promise<Set<string>> {
    const dependencies = await this.moduleGraph.loadPath(file);
    this.dependencies.set(file, dependencies);
    return dependencies;
  }

  private analyzeLoaded(file: string): void {
    const root = this.settings.projectRoot;
    const usages = analyzeModule({ graph: this.moduleGraph, file, root });
    const record = this.moduleGraph.getRecord(file);
    this.tagInlangProjects(usages);
    this.checkCatalog(file, usages);
    this.analyzed.set(file, usages.length);
    this.output.set(
      file,
      record && usages.length > 0
        ? { file: this.relative(file), code: record.code, usages }
        : undefined
    );
  }

  /** Reads the catalog of every known outdir not read yet. */
  private async loadCatalogs(): Promise<void> {
    await Promise.all(
      this.moduleGraph.outdirs
        .filter((outdir) => !this.catalogs.has(outdir))
        .map(async (outdir) => {
          const catalog = await readCatalog(outdir).catch(() => undefined);
          this.catalogs.set(outdir, catalog);
          await this.pairProject(outdir, catalog);
        })
    );
  }

  /** Pairs `outdir` with its inlang project, whose messages get metadata files. */
  private async pairProject(
    outdir: string,
    catalog: Set<string> | undefined
  ): Promise<void> {
    const project = await this.outdirProjects.pair(outdir, catalog);
    if (!project) {
      this.warn(
        `no inlang project found for ${this.relative(outdir)}; its messages get no metadata file. ` +
          'List its project in the `inlangProjects` option.'
      );
      return;
    }

    this.output.addProject(project.directory);

    const hasMessageFiles = project.messageFiles.length > 0;
    if (hasMessageFiles) return;

    this.warn(
      `${this.relative(project.directory)} has no base-locale message files in the inlang message format ` +
        '(`plugin.inlang.messageFormat`); its messages get no metadata file'
    );
  }

  /** Re-reads an outdir's catalog; re-checks every file if it changed. */
  private async refreshCatalog(outdir: string): Promise<void> {
    const before = this.catalogs.get(outdir);
    const after = await readCatalog(outdir).catch(() => undefined);
    const same =
      before !== undefined &&
      after !== undefined &&
      before.size === after.size &&
      [...after].every((id) => before.has(id));
    if (
      same ||
      (before === undefined && after === undefined && this.catalogs.has(outdir))
    )
      return;
    this.catalogs.set(outdir, after);
    await this.pairProject(outdir, after);
    for (const file of this.analyzed.keys()) this.analyzeLoaded(file);
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

  /** Marks message usages that are not in their outdir's catalog. */
  private checkCatalog(file: string, usages: readonly ParaglideUsage[]): void {
    const unknown: string[] = [];
    for (const usage of usages) {
      const outdir = this.messageOutdir(usage);
      const catalog = outdir && this.catalogs.get(outdir);
      if (!catalog) continue;
      if (usage.dynamic) {
        const matches = [...catalog]
          .filter((id) => matchesPattern(usage.name, id))
          .sort();
        usage.catalog = {
          exists: matches.length > 0,
          matches:
            matches.length > MAX_MATCHES
              ? [
                  ...matches.slice(0, MAX_MATCHES),
                  `… ${matches.length - MAX_MATCHES} more`,
                ]
              : matches,
        };
      } else {
        usage.catalog = { exists: catalog.has(usage.name) };
      }
      if (!usage.catalog.exists) {
        unknown.push(
          `${usage.name} (${this.relative(file)}:${usage.line}:${usage.column})`
        );
      }
    }
    if (unknown.length > 0) this.unknownMessages.set(file, unknown);
    else this.unknownMessages.delete(file);
  }

  private warnUnknownMessages(): void {
    const unknown = [...this.unknownMessages.values()].flat();
    if (unknown.length === 0) return;
    const listed = unknown.slice(0, MAX_LISTED).join(', ');
    const more =
      unknown.length > MAX_LISTED
        ? `, and ${unknown.length - MAX_LISTED} more`
        : '';
    this.warn(
      `${unknown.length} usage(s) of messages not in the catalog: ${listed}${more}`
    );
  }

  /** The outdir of the message a usage resolves to; undefined for other targets. */
  private messageOutdir(usage: ParaglideUsage): string | undefined {
    if (usage.target !== 'message') return undefined;

    const messageFile = usage.resolution.at(-1);
    if (!messageFile) return undefined;

    return this.outdirOf(path.resolve(this.settings.projectRoot, messageFile));
  }

  /** The known outdir containing `file`, the innermost if nested. */
  private outdirOf(file: string): string | undefined {
    return this.moduleGraph.outdirs.find((outdir) => isWithin(outdir, file));
  }

  /** Makes auto-imported names visible in every module. */
  private async loadGlobals(
    declarationFiles: readonly string[]
  ): Promise<void> {
    const { autoImports, projectRoot } = this.settings;
    this.globalDependencies = new Set();
    if (autoImports === false) {
      this.moduleGraph.setGlobals([]);
      return;
    }
    const detected = await detectAutoImports(projectRoot, declarationFiles);
    for (const file of detected.files) this.globalDependencies.add(file);
    const imports = [
      ...autoImportsFromOptions(autoImports ?? {}, projectRoot),
      ...detected.imports,
    ];

    const globals: GlobalBinding[] = [];
    const names = new Set<string>();
    // Many names come from one module, e.g. `ref` and `computed` from "vue".
    const resolved = new Map<string, Promise<string | undefined>>();
    const resolveOnce = ({ specifier, importer }: AutoImport) => {
      const key = `${importer}\0${specifier}`;
      if (!resolved.has(key))
        resolved.set(key, this.resolve(specifier, importer));
      return resolved.get(key)!;
    };
    await Promise.all(
      imports.map(async (autoImport: AutoImport) => {
        const file = await resolveOnce(autoImport);
        if (!file || names.has(autoImport.name)) return;
        names.add(autoImport.name);
        globals.push({
          name: autoImport.name,
          file,
          exportName: autoImport.exportName,
        });
        await this.moduleGraph.detectOutdir(file);
        if (
          !this.moduleGraph.targetOf(file) &&
          this.isSourceFile(file) &&
          !isDependency(file)
        ) {
          for (const visited of await this.moduleGraph.loadPath(file)) {
            this.globalDependencies.add(visited);
          }
        }
      })
    );
    // Declaration order decides which of two auto-imports of a name wins.
    const order = new Map(
      imports.map((autoImport, index) => [autoImport.name, index])
    );
    globals.sort((a, b) => order.get(a.name)! - order.get(b.name)!);
    this.moduleGraph.setGlobals(globals);
  }

  private isSource(file: string): boolean {
    return this.included.has(file) && !this.moduleGraph.isGenerated(file);
  }

  private async isOutdir(directory: string): Promise<boolean> {
    if (this.settings.outdirs.includes(directory)) return true;
    const verdict = await this.outDirDetector.check(directory);
    if (!verdict.outdir && verdict.reason) {
      this.warn(
        `${this.relative(directory)} is not used as a Paraglide outdir: ${verdict.reason}. ` +
          'If it is one, add it to the `outdirs` option.'
      );
    }
    return verdict.outdir;
  }

  private warn(message: string): void {
    if (this.warnedMessages.has(message)) return;
    this.warnedMessages.add(message);
    this.settings.logger.warn(`${LOG_PREFIX} ${message}`);
  }

  private relative(file: string): string {
    return relativePath(this.settings.projectRoot, file);
  }

  private async resolve(
    specifier: string,
    importer: string
  ): Promise<string | undefined> {
    // Builtins are never Paraglide.
    if (isBuiltin(specifier)) return undefined;
    const id = await this.settings
      .resolver(specifier, importer)
      .catch(() => undefined);
    const file = id?.split('?', 1)[0];
    // A resolver may answer with something that is not a file, e.g. a virtual module.
    if (file && path.isAbsolute(file)) return path.normalize(file);
    if (
      !id &&
      /(^|[/\\])paraglide[/\\]/.test(specifier) &&
      !specifier.startsWith('@inlang/')
    ) {
      this.warn(
        `could not resolve "${specifier}" from ${this.relative(importer)}; usages through it are not recorded`
      );
    }
    return undefined;
  }

  /**
   * One warning per language whose tools are unavailable, e.g.
   * "14 .vue file(s) were not analyzed (e.g. src/App.vue): they need
   * @vue/language-core, which is not installed. Install it: pnpm add -D @vue/language-core"
   */
  private async warnMissingTools(): Promise<void> {
    for (const [language, { requires, reason, files }] of this.missingTools) {
      // Once per project and language, also across collectors.
      const key = `${this.settings.projectRoot}\0${language}`;
      if (WARNED_LANGUAGES.has(key)) continue;
      WARNED_LANGUAGES.add(key);
      const extensions = [
        ...new Set([...files].map((file) => path.extname(file))),
      ].join(', ');
      const example = this.relative([...files].sort()[0]!);
      const skipped = `${files.size} ${extensions} file(s) were not analyzed (e.g. ${example})`;
      if (reason) {
        this.warn(`${skipped}: ${reason}.`);
        continue;
      }
      const missing: string[] = [];
      for (const name of requires) {
        if ((await this.packages.load(name)) === undefined) missing.push(name);
      }
      if (missing.length === 0) {
        this.warn(`${skipped}: ${requires.join(' and ')} could not be loaded.`);
        continue;
      }
      const list = missing.join(' and ');
      const installedWith = this.settings.languages.find(
        ({ name }) => name === language
      )?.installedWith;
      const install = [
        ...new Set(missing.map((name) => installedWith?.[name] ?? name)),
      ];
      const command = await addDevDependencyCommand(
        this.settings.projectRoot,
        install
      );
      // `(vue-tsc includes @vue/language-core)`
      const includes = missing
        .filter((name) => installedWith?.[name])
        .map((name) => ` (${installedWith![name]} includes ${name})`)
        .join('');
      this.warn(
        `${skipped}: they need ${list}, which ${missing.length > 1 ? 'are' : 'is'} not installed. ` +
          `Install ${missing.length > 1 ? 'them' : 'it'}: ${command}${includes}`
      );
    }
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
    if ('error' in parsed) {
      if (parsed.missing && parsed.language) {
        // One warning per language, after the scan.
        const entry = this.missingTools.get(parsed.language) ?? {
          requires: parsed.missing,
          reason: parsed.reason,
          files: new Set<string>(),
        };
        entry.files.add(file);
        this.missingTools.set(parsed.language, entry);
      } else {
        // While a file is being edited, its last version that parsed stands in.
        const last = this.lastParsed.get(file);
        this.warn(
          last
            ? `${this.relative(file)} does not parse (${parsed.error}); its last version that did is used`
            : `skipped ${this.relative(file)}: ${parsed.error}`
        );
        return last;
      }
      return undefined;
    }
    this.lastParsed.set(file, parsed.module);
    return parsed.module;
  }
}
