import {
  moduleExportName,
  unwrapExpression,
  type ESTree,
  type FunctionNode,
  type Node,
} from './ast.js';
import {
  argumentOf,
  callSitesIn,
  componentInstancesIn,
  type CallSite,
  type CallSiteIndex,
  type Candidate,
} from './call-sites.js';
import { followCandidate } from './evaluate.js';
import type { ModuleRecord } from './module-graph.js';
import {
  declaredNames,
  importedName,
  importOf,
  valueImports,
} from './module-syntax.js';
import type { Scope } from './scope.js';
import { prependVia } from './tracked-symbols.js';
import type { TrackedSymbol } from './types.js';

/** An auto-imported name: what it stands for, and the node its call sites are indexed under. */
export type GlobalExport = {
  declaration: Node;
  file: string;
  exportName: string;
};

export type LoadedModules = {
  /** In loading order. */
  records: ReadonlyMap<string, ModuleRecord>;
  scopeOf(file: string): Scope | undefined;
  /** Changes whenever a module is added or removed. */
  generation(): number;
  globalExports(): readonly GlobalExport[];
};

/** Some of a module's exports, by the names it exports them under. */
type ExportedNames = { file: string; names: readonly string[] };

/** Everything that can refer to some exports of a module. */
type Referrers = {
  /** In loading order. */
  modules: Iterable<ModuleRecord>;
  globals: readonly GlobalExport[];
  /** The exporting module and every module that may re-export from it. */
  exporters: ReadonlySet<string>;
  /** The names the exports can have in `exporters`, which may rename them. */
  exportedAs: ReadonlySet<string>;
};

type Rename = { imported: string; exported: string };

/** What a module imports and re-exports, by resolved file. */
type Links = {
  importedNames: Map<string, Set<string>>;
  importedNamespaces: Set<string>;
  /** The files whose exports it may re-export. */
  reexported: Set<string>;
  renames: Rename[];
};

/** Who imports each file. */
type Dependents = {
  loadingOrder: Map<ModuleRecord, number>;
  /** By file, then by export name. */
  importers: Map<string, Map<string, ModuleRecord[]>>;
  namespaceImporters: Map<string, ModuleRecord[]>;
  reexporters: Map<string, ModuleRecord[]>;
};

type Cache = {
  generation: number;
  callSites: Map<FunctionNode, CallSite[]>;
  componentProps: Map<ModuleRecord, Candidate[]>;
  dependents?: Dependents;
};

type IndexSites = (program: ESTree.Program, scope: Scope) => CallSiteIndex;

const links = new WeakMap<ModuleRecord, Links>();

/**
 * Finds where a module's functions are called and its component is rendered:
 * in the module and in the modules that import it, directly or through
 * re-exports. Only those are searched, not every module for every function.
 */
export class ImporterIndex {
  private cache: Cache | undefined;

  constructor(private readonly modules: LoadedModules) {}

  callSitesOf(record: ModuleRecord, fn: FunctionNode): CallSite[] {
    const { callSites } = this.currentCache();

    const cached = callSites.get(fn);
    if (cached) return cached;

    // Cached before it is filled, so that a cycle of calls ends.
    const sites: CallSite[] = [];
    callSites.set(fn, sites);

    const scope = this.modules.scopeOf(record.file);
    if (!scope) return sites;

    const sitesInOwnModule =
      callSitesIn(record.program, scope).byDeclaration.get(fn) ?? [];
    sites.push(...sitesInOwnModule);

    const exportNames = exportNamesOf(record.program, fn, scope);
    if (exportNames.length === 0) return sites;

    const exported = { file: record.file, names: exportNames };
    const referrers = this.referrersOf(exported);

    for (const importer of referrers.modules) {
      if (importer === record) continue;

      sites.push(...this.sitesIn(importer, exported, referrers, callSitesIn));
    }

    return sites;
  }

  /** The props each module that imports `record`'s component renders it with. */
  componentProps(record: ModuleRecord): Candidate[] {
    const { componentProps } = this.currentCache();

    const cached = componentProps.get(record);
    if (cached) return cached;

    // Cached before it is filled, so that a component rendering itself ends.
    const props: Candidate[] = [];
    componentProps.set(record, props);

    const component = { file: record.file, names: ['default'] };
    const referrers = this.referrersOf(component);

    for (const importer of referrers.modules) {
      if (importer === record) continue;

      props.push(...this.jsxProps(importer, component, referrers));
      props.push(...this.instanceProps(importer, component, referrers));
    }

    return props;
  }

  private jsxProps(
    importer: ModuleRecord,
    component: ExportedNames,
    referrers: Referrers
  ): Candidate[] {
    const props: Candidate[] = [];

    for (const site of this.sitesIn(
      importer,
      component,
      referrers,
      callSitesIn
    )) {
      const elementProps =
        site.type === 'jsx' ? argumentOf(site, 0) : undefined;
      if (elementProps) props.push(elementProps);
    }

    return props;
  }

  /** Of the components a language tool's generated code instantiates: `new Label({ props })`. */
  private instanceProps(
    importer: ModuleRecord,
    component: ExportedNames,
    referrers: Referrers
  ): Candidate[] {
    const instances = importer.componentInstances;
    if (!instances) return [];

    const instancesIn: IndexSites = (program, scope) =>
      componentInstancesIn(program, scope, instances.via);
    const props: Candidate[] = [];

    for (const site of this.sitesIn(
      importer,
      component,
      referrers,
      instancesIn
    )) {
      const options = argumentOf(site, 0);
      if (options) props.push(followCandidate(options, instances.path));
    }

    return props;
  }

  private currentCache(): Cache {
    const generation = this.modules.generation();

    if (this.cache?.generation !== generation) {
      this.cache = {
        generation,
        callSites: new Map(),
        componentProps: new Map(),
      };
    }

    return this.cache;
  }

  private dependents(): Dependents {
    const cache = this.currentCache();
    cache.dependents ??= dependentsOf(this.modules.records.values());

    return cache.dependents;
  }

  private referrersOf(exported: ExportedNames): Referrers {
    const dependents = this.dependents();
    const { exporters, exportedAs } = reexportsOf(
      exported,
      dependents.reexporters
    );

    const globals = this.modules
      .globalExports()
      .filter(({ file, exportName }) => {
        return (
          exporters.has(file) &&
          this.isExported(file, exportName, exported, exporters)
        );
      });

    const isUsableWithoutImport = globals.length > 0;
    const modules = isUsableWithoutImport
      ? this.modules.records.values()
      : importersOf(exporters, exportedAs, dependents);

    return { modules, globals, exporters, exportedAs };
  }

  /** The sites in `importer` that refer to `exported`; what they pass records `importer` in its resolution. */
  private sitesIn(
    importer: ModuleRecord,
    exported: ExportedNames,
    referrers: Referrers,
    indexSites: IndexSites
  ): CallSite[] {
    const imports = valueImports(importer.program);
    if (imports.length === 0 && referrers.globals.length === 0) return [];

    const scope = this.modules.scopeOf(importer.file);
    if (!scope) return [];

    const index = indexSites(importer.program, scope);
    const sites: CallSite[] = [];

    for (const { declaration } of referrers.globals) {
      sites.push(...(index.byDeclaration.get(declaration) ?? []));
    }

    for (const statement of imports) {
      sites.push(
        ...this.sitesOfImport(statement, importer, index, exported, referrers)
      );
    }

    const viaImporter = (symbol: TrackedSymbol) =>
      prependVia(importer.file, symbol);

    return sites.map((site) => ({ ...site, map: viaImporter }));
  }

  private sitesOfImport(
    statement: ESTree.ImportDeclaration,
    importer: ModuleRecord,
    index: CallSiteIndex,
    exported: ExportedNames,
    { exporters, exportedAs }: Referrers
  ): CallSite[] {
    const from = importer.resolved.get(statement.source.value);
    if (from === undefined || !exporters.has(from)) return [];

    const isExported = (name: string) =>
      exportedAs.has(name) && this.isExported(from, name, exported, exporters);
    const sites: CallSite[] = [];

    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportNamespaceSpecifier') {
        const sitesOfName = index.byDeclaration.get(specifier) ?? [];
        if (isExported(importedName(specifier))) sites.push(...sitesOfName);
        continue;
      }

      const sitesByMember = index.byNamespaceMember.get(specifier) ?? [];

      for (const [member, sitesOfMember] of sitesByMember) {
        if (isExported(member)) sites.push(...sitesOfMember);
      }
    }

    return sites;
  }

  /**
   * Whether `file`'s export `name` is, through `export { f } from`, `export *`
   * or `import { f } …; export { f }`, one of `exported`. Only `exporters` are read.
   */
  private isExported(
    file: string,
    name: string,
    exported: ExportedNames,
    exporters: ReadonlySet<string>,
    seen = new Set<string>()
  ): boolean {
    if (file === exported.file) return exported.names.includes(name);

    const record = this.modules.records.get(file);
    const key = `${file}\0${name}`;
    if (!record || seen.has(key)) return false;
    seen.add(key);

    const isExportedBy = (specifier: string, exportName: string) => {
      const from = record.resolved.get(specifier);
      if (from === undefined || !exporters.has(from)) return false;

      return this.isExported(from, exportName, exported, exporters, seen);
    };

    for (const statement of record.program.body) {
      if (statement.type === 'ExportAllDeclaration') {
        const reexportsName = !statement.exported && name !== 'default';
        if (reexportsName && isExportedBy(statement.source.value, name))
          return true;
        continue;
      }

      if (
        statement.type !== 'ExportNamedDeclaration' ||
        statement.exportKind === 'type'
      )
        continue;

      const specifier = statement.specifiers.find(
        (candidate) => moduleExportName(candidate.exported) === name
      );
      if (!specifier) continue;

      const local = moduleExportName(specifier.local);
      if (statement.source) return isExportedBy(statement.source.value, local);

      const imported = importOf(record.program, local);
      return (
        imported !== undefined && isExportedBy(imported.source, imported.name)
      );
    }

    return false;
  }
}

function dependentsOf(records: Iterable<ModuleRecord>): Dependents {
  const dependents: Dependents = {
    loadingOrder: new Map(),
    importers: new Map(),
    namespaceImporters: new Map(),
    reexporters: new Map(),
  };

  for (const record of records) {
    dependents.loadingOrder.set(record, dependents.loadingOrder.size);

    const { importedNames, importedNamespaces, reexported } = linksOf(record);

    for (const [file, names] of importedNames) {
      const importersByName = getOrCreate(
        dependents.importers,
        file,
        () => new Map()
      );
      for (const name of names) append(importersByName, name, record);
    }

    for (const file of importedNamespaces)
      append(dependents.namespaceImporters, file, record);
    for (const file of reexported) append(dependents.reexporters, file, record);
  }

  return dependents;
}

function importersOf(
  exporters: ReadonlySet<string>,
  exportedAs: ReadonlySet<string>,
  { importers, namespaceImporters, loadingOrder }: Dependents
): ModuleRecord[] {
  const found = new Set<ModuleRecord>();

  for (const file of exporters) {
    const importersByName = importers.get(file);
    const ofNamespace = namespaceImporters.get(file) ?? [];
    const ofNames = [...exportedAs].flatMap(
      (name) => importersByName?.get(name) ?? []
    );

    for (const importer of [...ofNamespace, ...ofNames]) found.add(importer);
  }

  return [...found].sort((a, b) => loadingOrder.get(a)! - loadingOrder.get(b)!);
}

function reexportsOf(
  { file, names }: ExportedNames,
  reexporters: ReadonlyMap<string, readonly ModuleRecord[]>
): { exporters: Set<string>; exportedAs: Set<string> } {
  const exporters = new Set([file]);
  const renames: Rename[] = [];

  // Grows while it is iterated: re-exports of re-exports.
  for (const exporter of exporters) {
    for (const record of reexporters.get(exporter) ?? []) {
      if (exporters.has(record.file)) continue;

      exporters.add(record.file);
      renames.push(...linksOf(record).renames);
    }
  }

  return { exporters, exportedAs: namesAfterRenames(names, renames) };
}

function namesAfterRenames(
  names: readonly string[],
  renames: readonly Rename[]
): Set<string> {
  const exportedAs = new Set(names);
  let renamedFurther = true;

  while (renamedFurther) {
    const sizeBefore = exportedAs.size;

    for (const { imported, exported } of renames) {
      if (exportedAs.has(imported)) exportedAs.add(exported);
    }

    renamedFurther = exportedAs.size > sizeBefore;
  }

  return exportedAs;
}

function linksOf(record: ModuleRecord): Links {
  const cached = links.get(record);
  if (cached) return cached;

  const found: Links = {
    importedNames: new Map(),
    importedNamespaces: new Set(),
    reexported: new Set(),
    renames: [],
  };
  links.set(record, found);

  for (const statement of record.program.body) {
    if (statement.type === 'ImportDeclaration') {
      addImports(found, statement, record);
    } else if (statement.type === 'ExportAllDeclaration') {
      addStarExport(found, statement, record);
    } else if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.exportKind !== 'type'
    ) {
      addNamedExports(found, statement, record);
    }
  }

  return found;
}

function addImports(
  { importedNames, importedNamespaces }: Links,
  statement: ESTree.ImportDeclaration,
  record: ModuleRecord
): void {
  if (statement.importKind === 'type') return;

  const file = record.resolved.get(statement.source.value);
  if (file === undefined) return;

  for (const specifier of statement.specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      importedNamespaces.add(file);
    } else {
      const names = getOrCreate(importedNames, file, () => new Set<string>());
      names.add(importedName(specifier));
    }
  }
}

function addStarExport(
  { reexported }: Links,
  statement: ESTree.ExportAllDeclaration,
  record: ModuleRecord
): void {
  // `export * as ns` exports a namespace, not the module's exports.
  if (statement.exported) return;

  const file = record.resolved.get(statement.source.value);
  if (file !== undefined) reexported.add(file);
}

function addNamedExports(
  { reexported, renames }: Links,
  statement: ESTree.ExportNamedDeclaration,
  record: ModuleRecord
): void {
  for (const specifier of statement.specifiers) {
    const local = moduleExportName(specifier.local);
    const imported = statement.source
      ? { source: statement.source.value, name: local }
      : importOf(record.program, local);
    if (!imported) continue;

    const file = record.resolved.get(imported.source);
    if (file === undefined) continue;

    reexported.add(file);
    renames.push({
      imported: imported.name,
      exported: moduleExportName(specifier.exported),
    });
  }
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);

  if (value === undefined) {
    value = create();
    map.set(key, value);
  }

  return value;
}

function append(
  map: Map<string, ModuleRecord[]>,
  key: string,
  record: ModuleRecord
): void {
  getOrCreate(map, key, () => []).push(record);
}

/** `export function f`, `export { f as g }`, `export default f` */
function exportNamesOf(
  program: ESTree.Program,
  fn: FunctionNode,
  scope: Scope
): string[] {
  const declaresFn = (local: string) =>
    scope.bindingOf(local)?.declaration === fn;
  const names: string[] = [];

  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const value = unwrapExpression(statement.declaration);
      const isFn =
        value === fn || (value.type === 'Identifier' && declaresFn(value.name));
      if (isFn) names.push('default');
      continue;
    }

    if (statement.type !== 'ExportNamedDeclaration' || statement.source)
      continue;

    const declared = statement.declaration
      ? declaredNames(statement.declaration)
      : [];
    names.push(...declared.filter(declaresFn));

    for (const specifier of statement.specifiers) {
      const isFn = declaresFn(moduleExportName(specifier.local));
      if (isFn) names.push(moduleExportName(specifier.exported));
    }
  }

  return names;
}
