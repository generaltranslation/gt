import path from 'node:path';
import { moduleExportName, type ESTree, type Node } from './ast.js';
import { commonJsExports } from './commonjs.js';
import { componentFieldBindings } from './component-fields.js';
import { evaluate, followCandidate, memberOf } from './evaluate.js';
import { ImporterIndex, type GlobalExport } from './importers.js';
import {
  declaredNames,
  hasEsmExports,
  loadedSpecifiers,
} from './module-syntax.js';
import { Scope, type Binding, type ModuleHost } from './scope.js';
import { prependVia, symbolFromSpec } from './tracked-symbols.js';
import type { ElementRange, TrackedSymbol } from './types.js';
import type { SourceElement } from '../languages/elements.js';
import type {
  ComponentFields,
  GeneratedSource,
} from '../languages/language.js';
import type { ParaglideTarget, TargetFile } from '../paraglide/targets.js';
import {
  isDependency,
  isScript,
  isWithin,
  relativeWithin,
  toPosix,
} from '../utils/paths.js';

export type ParsedModule = {
  code: string;
  program: ESTree.Program;
  /** The element of each template expression. */
  elements?: readonly ElementRange[];
  /** e.g. "Header" for `Header.vue`. */
  component?: string;
  /** Written by a language's tooling: nodes that are not in the file are at -1. */
  generated?: boolean;
  /** The file's elements, from the framework's parser. */
  sourceElements?: readonly SourceElement[];
  /** Objects the generated code reads the component's names through, e.g. `__VLS_ctx`. */
  scopeObjects?: readonly string[];
  componentFields?: readonly ComponentFields[];
  props?: GeneratedSource['props'];
  componentInstances?: GeneratedSource['componentInstances'];
};

/** A name every module can use without importing it, e.g. from unplugin-auto-import. */
export type GlobalBinding = {
  name: string;
  /** Absolute. */
  file: string;
  /** "*" for the module namespace. */
  exportName: string;
};

export type ModuleGraphOptions = {
  resolve(specifier: string, importer: string): Promise<string | undefined>;
  readModule(file: string): Promise<ParsedModule | undefined>;
  targets: readonly ParaglideTarget[];
  /** Known Paraglide outdirs, absolute. */
  outdirs?: readonly string[];
  /** Verifies that a directory imports reach is a Paraglide outdir. */
  isOutdir?(directory: string): Promise<boolean>;
  /** Whether to parse a non-target module to follow its exports. */
  shouldFollow?(file: string): boolean;
  globals?: readonly GlobalBinding[];
};

export type ModuleRecord = ParsedModule & {
  file: string;
  /** The file of each specifier the module loads. */
  resolved: Map<string, string | undefined>;
  scope?: Scope;
};

type TargetMatch = { target: ParaglideTarget; file: TargetFile };

/** A looked-up export; `symbol` is undefined when the export is not tracked. */
type FoundExport = { symbol: TrackedSymbol | undefined };

const GENERATED_FILES = new Set([
  'messages.js',
  'runtime.js',
  'server.js',
  'registry.js',
]);

const followsScripts = (file: string) => isScript(file) && !isDependency(file);

/** Modules linked by resolved imports. Loading is async; lookups are synchronous. */
export class ModuleGraph {
  private readonly options: ModuleGraphOptions;

  /** Longest first, so that a nested outdir wins over its parent. */
  private knownOutdirs: readonly string[] = [];
  private readonly outdirDetections = new Map<string, Promise<void>>();
  private readonly targets = new Map<string, TargetMatch | undefined>();

  private readonly loading = new Map<
    string,
    Promise<ModuleRecord | undefined>
  >();
  private readonly records = new Map<string, ModuleRecord>();
  /** Changes whenever a module is added or removed. */
  private generation = 0;

  private globals = new Map<string, Binding>();
  private globalExports: GlobalExport[] = [];

  private readonly exportsBeingResolved = new Set<string>();
  private readonly importers = new ImporterIndex({
    records: this.records,
    scopeOf: (file) => this.moduleScope(file),
    generation: () => this.generation,
    globalExports: () => this.globalExports,
  });

  constructor(options: ModuleGraphOptions) {
    this.options = options;

    for (const outdir of options.outdirs ?? []) this.addOutdir(outdir);
    this.declareGlobals(options.globals ?? []);
  }

  setGlobals(globals: readonly GlobalBinding[]): void {
    this.declareGlobals(globals);

    for (const record of this.records.values()) record.scope = undefined;
    this.generation++;
  }

  get outdirs(): readonly string[] {
    return this.knownOutdirs;
  }

  isGenerated(file: string): boolean {
    return this.knownOutdirs.some((outdir) => isWithin(outdir, file));
  }

  /** Verifies the outdir a resolved file may belong to. */
  async detectOutdir(file: string): Promise<void> {
    const { isOutdir } = this.options;
    if (!isOutdir) return;

    const detect = (directory: string) => {
      let detection = this.outdirDetections.get(directory);

      if (!detection) {
        detection = isOutdir(directory).then((verified) => {
          if (verified) this.addOutdir(directory);
        });
        this.outdirDetections.set(directory, detection);
      }

      return detection;
    };

    await Promise.all(outdirCandidates(file).map(detect));
  }

  /** Loads `entry` and every module reachable from it. Returns the files visited. */
  async loadPath(entry: string): Promise<Set<string>> {
    const visited = new Set<string>();
    let frontier = [entry];

    while (frontier.length > 0) {
      for (const file of frontier) visited.add(file);

      const records = await Promise.all(
        frontier.map((file) => this.loadRecord(file))
      );
      const dependencies = dependenciesOf(records);

      // Outdirs must be known before deciding what is a target.
      await Promise.all(dependencies.map((file) => this.detectOutdir(file)));

      frontier = dependencies.filter(
        (file) => !visited.has(file) && this.shouldFollow(file)
      );
    }

    return visited;
  }

  invalidate(file: string): void {
    this.loading.delete(file);
    this.records.delete(file);
    this.generation++;
  }

  clear(): void {
    this.generation++;
    this.loading.clear();
    this.records.clear();
    this.targets.clear();
    this.outdirDetections.clear();

    this.knownOutdirs = [];
    for (const outdir of this.options.outdirs ?? []) this.addOutdir(outdir);
  }

  getRecord(file: string): ModuleRecord | undefined {
    return this.records.get(file);
  }

  moduleScope(file: string): Scope | undefined {
    const record = this.records.get(file);
    if (!record) return undefined;

    record.scope ??= this.createScope(record);

    return record.scope;
  }

  targetOf(file: string): TargetMatch | undefined {
    if (!this.targets.has(file)) this.targets.set(file, this.findTarget(file));

    return this.targets.get(file);
  }

  namespaceOf(file: string): TrackedSymbol | undefined {
    const isKnown = this.targetOf(file) !== undefined || this.records.has(file);
    if (!isKnown) return undefined;

    return { type: 'namespace', member: (name) => this.exportOf(file, name) };
  }

  exportOf(file: string, name: string): TrackedSymbol | undefined {
    const match = this.targetOf(file);

    if (match) {
      const spec = match.target.exportSymbol(name, match.file);
      return spec && symbolFromSpec(spec, match.target.name, [file]);
    }

    const record = this.records.get(file);
    const key = `${file}\0${name}`;
    if (!record || this.exportsBeingResolved.has(key)) return undefined;

    this.exportsBeingResolved.add(key);
    try {
      const symbol = this.localExport(record, name);
      return symbol && prependVia(file, symbol);
    } finally {
      this.exportsBeingResolved.delete(key);
    }
  }

  private findTarget(file: string): TargetMatch | undefined {
    const outdir = this.knownOutdirs.find((directory) =>
      isWithin(directory, file)
    );
    const targetFile: TargetFile = {
      file: toPosix(file),
      outdir: outdir && toPosix(outdir),
      outdirPath: outdir && relativeWithin(outdir, file),
    };

    // The last one, so that `[...defaultTargets, custom]` overrides a built-in target.
    const target = this.options.targets.findLast((candidate) =>
      candidate.matches(targetFile)
    );

    return target && { target, file: targetFile };
  }

  private localExport(
    record: ModuleRecord,
    name: string
  ): TrackedSymbol | undefined {
    const scope = this.moduleScope(record.file)!;

    for (const statement of record.program.body) {
      const found = this.exportDeclaredBy(statement, name, record, scope);
      if (found) return found.symbol;
    }

    if (!hasEsmExports(record.program))
      return this.commonJsExport(record, scope, name);

    // `export *` does not re-export "default".
    if (name === 'default') return undefined;

    for (const file of starExportedFiles(record)) {
      const symbol = this.exportOf(file, name);
      if (symbol) return symbol;
    }

    return undefined;
  }

  /** The export `name`, if `statement` is the one that declares it. */
  private exportDeclaredBy(
    statement: ESTree.Statement | ESTree.Directive,
    name: string,
    record: ModuleRecord,
    scope: Scope
  ): FoundExport | undefined {
    switch (statement.type) {
      case 'ExportDefaultDeclaration':
        return name === 'default'
          ? { symbol: evaluate(statement.declaration, scope) }
          : undefined;
      case 'ExportAllDeclaration':
        return this.namespaceExport(statement, name, record);
      case 'ExportNamedDeclaration':
        return this.namedExport(statement, name, record, scope);
      default:
        return undefined;
    }
  }

  /** `export * as name from "./a"` */
  private namespaceExport(
    statement: ESTree.ExportAllDeclaration,
    name: string,
    record: ModuleRecord
  ): FoundExport | undefined {
    if (statement.exportKind === 'type' || !statement.exported)
      return undefined;
    if (moduleExportName(statement.exported) !== name) return undefined;

    const file = record.resolved.get(statement.source.value);

    return file ? { symbol: this.namespaceOf(file) } : undefined;
  }

  private namedExport(
    statement: ESTree.ExportNamedDeclaration,
    name: string,
    record: ModuleRecord,
    scope: Scope
  ): FoundExport | undefined {
    if (statement.exportKind === 'type') return undefined;

    if (statement.declaration) {
      const declaresName = declaredNames(statement.declaration).includes(name);
      return declaresName ? { symbol: scope.lookup(name) } : undefined;
    }

    const specifier = statement.specifiers.find(
      (candidate) =>
        candidate.exportKind !== 'type' &&
        moduleExportName(candidate.exported) === name
    );
    if (!specifier) return undefined;

    const local = moduleExportName(specifier.local);
    if (!statement.source) return { symbol: scope.lookup(local) };

    const file = record.resolved.get(statement.source.value);

    return { symbol: file ? this.exportOf(file, local) : undefined };
  }

  private commonJsExport(
    record: ModuleRecord,
    scope: Scope,
    name: string
  ): TrackedSymbol | undefined {
    const exports = commonJsExports(record.program);
    if (!exports) return undefined;

    const named = exports.named.get(name);
    if (named) return evaluate(named, scope);

    if (exports.whole) {
      const whole = evaluate(exports.whole, scope);
      // `import x from "./cjs"` is the whole `module.exports`.
      if (name === 'default') return whole;

      const member = memberOf(whole, name);
      if (member) return member;
    }

    if (name === 'default') return undefined;

    for (const star of exports.stars) {
      const member = memberOf(evaluate(star, scope), name);
      if (member) return member;
    }

    return undefined;
  }

  private createScope(record: ModuleRecord): Scope {
    const fields = componentFieldBindings(record, this);
    const globals = this.globals;
    const props = this.undeclaredPropBindings(record);
    const implicitNames = (name: string) =>
      fields.get(name) ?? globals.get(name) ?? props?.(name);

    const overrides = new Map<string, Binding>();
    const scope = new Scope(
      record.program,
      this.hostOf(record),
      implicitNames,
      overrides
    );

    // `__VLS_ctx.title` reads the module's `title`, whatever the generated code declares `__VLS_ctx` as.
    for (const name of record.scopeObjects ?? []) {
      overrides.set(name, {
        type: 'lazy',
        get: () => ({
          type: 'namespace',
          member: (member: string) => scope.lookup(member),
        }),
      });
    }

    return scope;
  }

  private hostOf(record: ModuleRecord): ModuleHost {
    const fileOf = (specifier: string) => record.resolved.get(specifier);

    return {
      namespace: (specifier) => {
        const file = fileOf(specifier);
        return file ? this.namespaceOf(file) : undefined;
      },

      exportOf: (specifier, name) => {
        const file = fileOf(specifier);
        return file ? this.exportOf(file, name) : undefined;
      },

      callSitesOf: (fn) => this.importers.callSitesOf(record, fn),

      props: record.props && {
        reads: record.props,
        candidates: () => this.importers.componentProps(record),
      },
    };
  }

  /** Vue's template reads `message` of `defineProps(["message"])` without declaring it. */
  private undeclaredPropBindings(
    record: ModuleRecord
  ): ((name: string) => Binding) | undefined {
    if (!record.props?.undeclared) return undefined;

    const bindings = new Map<string, Binding>();

    const propBinding = (name: string): Binding => ({
      type: 'values',
      parameter: true,
      candidates: () => {
        const props = this.importers.componentProps(record);
        return props.map((candidate) => followCandidate(candidate, [name]));
      },
    });

    return (name) => {
      let binding = bindings.get(name);

      if (!binding) {
        binding = propBinding(name);
        bindings.set(name, binding);
      }

      return binding;
    };
  }

  private declareGlobals(globals: readonly GlobalBinding[]): void {
    this.globals = new Map();
    this.globalExports = [];

    for (const { name, file, exportName } of globals) {
      if (this.globals.has(name)) continue;

      // No node declares an auto-import; this one stands in, for its call sites.
      const declaration = { type: 'AutoImport', name } as unknown as Node;
      const isNamespace = exportName === '*';

      this.globals.set(name, {
        type: 'lazy',
        get: () =>
          isNamespace
            ? this.namespaceOf(file)
            : this.exportOf(file, exportName),
        declaration,
      });

      if (!isNamespace)
        this.globalExports.push({ declaration, file, exportName });
    }
  }

  private addOutdir(directory: string): void {
    if (this.knownOutdirs.includes(directory)) return;

    this.knownOutdirs = [...this.knownOutdirs, directory].sort(
      (a, b) => b.length - a.length
    );
    this.targets.clear();
  }

  private shouldFollow(file: string): boolean {
    const shouldFollow = this.options.shouldFollow ?? followsScripts;

    return !this.targetOf(file) && shouldFollow(file);
  }

  private loadRecord(file: string): Promise<ModuleRecord | undefined> {
    let loading = this.loading.get(file);

    if (!loading) {
      loading = this.readRecord(file).then((record) => {
        // A load that `invalidate()` superseded is dropped.
        const isCurrent = this.loading.get(file) === loading;

        if (record && isCurrent) {
          this.records.set(file, record);
          this.generation++;
        }

        return record;
      });
      this.loading.set(file, loading);
    }

    return loading;
  }

  private async readRecord(file: string): Promise<ModuleRecord | undefined> {
    const module = await this.options.readModule(file);
    if (!module) return undefined;

    const loaded = loadedSpecifiers(module.program);
    for (const { specifier } of module.componentFields ?? []) {
      if (specifier !== '') loaded.add(specifier);
    }

    const specifiers = [...loaded];
    const files = await Promise.all(
      specifiers.map((specifier) => this.options.resolve(specifier, file))
    );
    const resolved = new Map(
      specifiers.map((specifier, index) => [specifier, files[index]])
    );

    return { file, ...module, resolved };
  }
}

function dependenciesOf(
  records: ReadonlyArray<ModuleRecord | undefined>
): string[] {
  const dependencies = new Set<string>();

  for (const record of records) {
    for (const file of record?.resolved.values() ?? []) {
      if (file) dependencies.add(file);
    }
  }

  return [...dependencies];
}

/** The files of `export * from "./a"`. */
function starExportedFiles(record: ModuleRecord): string[] {
  const files: string[] = [];

  for (const statement of record.program.body) {
    const isStarExport =
      statement.type === 'ExportAllDeclaration' &&
      statement.exportKind !== 'type' &&
      !statement.exported;
    if (!isStarExport) continue;

    const file = record.resolved.get(statement.source.value);
    if (file) files.push(file);
  }

  return files;
}

/**
 * `…/paraglide/runtime.js` → `…/paraglide`; `…/paraglide/messages/a.js` and
 * Paraglide 1's `…/paraglide/messages/en/a.js` → `…/paraglide`
 */
function outdirCandidates(file: string): string[] {
  const parent = path.dirname(file);
  if (GENERATED_FILES.has(path.basename(file))) return [parent];

  const grandparent = path.dirname(parent);

  for (const directory of [parent, grandparent]) {
    if (path.basename(directory) === 'messages')
      return [path.dirname(directory)];
  }

  return [];
}
