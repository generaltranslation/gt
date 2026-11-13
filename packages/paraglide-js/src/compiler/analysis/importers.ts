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
  ownSite,
  sitePosition,
  type CallSite,
  type CallSiteIndex,
  type Candidate,
  type InstantiationSyntax,
  type SiteHandle,
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

/** An auto-imported name: what it stands for, and the node its call sites are indexed under. */
export type GlobalExport = {
  declaration: Node;
  file: string;
  exportName: string;
};

/** A module of a file: its own module (part 0), or one of its scripts (part 1 on). */
export type ModuleRef = { file: string; part: number };

export type LoadedModules = {
  /** A file's module, with its scripts. */
  record(file: string): ModuleRecord | undefined;
  /** The module `ref` names. */
  module(ref: ModuleRef): ModuleRecord | undefined;
  /** Every module with its links, in loading order: a file's scripts after its module. */
  links(): Iterable<{ ref: ModuleRef; links: Links }>;
  scopeOf(record: ModuleRecord): Scope;
  /** Changes whenever a module is added or removed. */
  generation(): number;
  globalExports(): readonly GlobalExport[];
};

/** Some of a module's exports, by the names it exports them under. */
type ExportedNames = { file: string; names: readonly string[] };

/** Everything that can refer to some exports of a module. */
type Referrers = {
  /** In loading order: each is loaded when it is searched. */
  modules: readonly ModuleRef[];
  globals: readonly GlobalExport[];
  /** The exporting module and every module that may re-export from it. */
  exporters: ReadonlySet<string>;
  /** The names the exports can have in `exporters`, which may rename them. */
  exportedAs: ReadonlySet<string>;
};

type Rename = { imported: string; exported: string };

/** What a module imports and re-exports, by resolved file. */
export type Links = {
  importedNames: Map<string, Set<string>>;
  importedNamespaces: Set<string>;
  /** The files whose exports it may re-export. */
  reexported: Set<string>;
  renames: Rename[];
};

/** A module's links before its specifiers are resolved: it reads only the syntax tree. */
export type SpecifierLinks = Array<
  | { type: 'import'; source: string; names: string[]; namespace: boolean }
  | { type: 'star'; source: string }
  | { type: 'reexport'; source: string; name: string; exported: string }
>;

/** Who imports each file. */
type Dependents = {
  /** By `refKey`. */
  loadingOrder: Map<string, number>;
  /** By `refKey`. */
  links: Map<string, Links>;
  /** By file, then by export name. */
  importers: Map<string, Map<string, ModuleRef[]>>;
  namespaceImporters: Map<string, ModuleRef[]>;
  reexporters: Map<string, ModuleRef[]>;
};

/** Handles and candidates only: holding a module's sites would hold the module. */
type Cache = {
  generation: number;
  callSites: WeakMap<FunctionNode, SiteHandle[]>;
  componentProps: WeakMap<ModuleRecord, Candidate[]>;
};

/** Which sites of a module: calls and JSX elements, or the components its generated code instantiates. */
type SiteKind = 'call-sites' | InstantiationSyntax;

const linksOfRecords = new WeakMap<ModuleRecord, Links>();

/**
 * Finds where a module's functions are called and its component is rendered:
 * in the module and in the modules that import it, directly or through
 * re-exports. Only those are searched, not every module for every function.
 */
export class ImporterIndex {
  private cache: Cache | undefined;
  /** Kept by `clear()`: it holds no module, only files. */
  private dependentsCache:
    | { generation: number; dependents: Dependents }
    | undefined;

  constructor(private readonly modules: LoadedModules) {}

  callSitesOf(record: ModuleRecord, fn: FunctionNode): SiteHandle[] {
    const { callSites } = this.currentCache();

    const cached = callSites.get(fn);
    if (cached) return cached;

    // Cached before it is filled, so that a cycle of calls ends.
    const sites: SiteHandle[] = [];
    callSites.set(fn, sites);

    const scope = this.modules.scopeOf(record);
    const sitesInOwnModule =
      callSitesIn(record.program, scope).byDeclaration.get(fn) ?? [];
    sites.push(...sitesInOwnModule.map(ownSite));

    const exportNames = exportNamesOf(record.program, fn, scope);
    if (exportNames.length === 0) return sites;

    const exported = { file: record.file, names: exportNames };
    const referrers = this.referrersOf(exported);

    for (const ref of referrers.modules) {
      const importer = this.modules.module(ref);
      if (!importer || importer === record) continue;

      sites.push(
        ...this.sitesIn(ref, importer, exported, referrers, 'call-sites')
      );
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

    for (const ref of referrers.modules) {
      const importer = this.modules.module(ref);
      if (!importer || importer === record) continue;

      props.push(...this.jsxProps(ref, importer, component, referrers));
      props.push(...this.instanceProps(ref, importer, component, referrers));
    }

    return props;
  }

  private jsxProps(
    ref: ModuleRef,
    importer: ModuleRecord,
    component: ExportedNames,
    referrers: Referrers
  ): Candidate[] {
    const props: Candidate[] = [];

    for (const site of this.sitesIn(
      ref,
      importer,
      component,
      referrers,
      'call-sites'
    )) {
      const elementProps =
        site.type === 'jsx' ? argumentOf(site, 0) : undefined;
      if (elementProps) props.push(elementProps);
    }

    return props;
  }

  /** Of the components a language tool's generated code instantiates: `new Label({ props })`. */
  private instanceProps(
    ref: ModuleRef,
    importer: ModuleRecord,
    component: ExportedNames,
    referrers: Referrers
  ): Candidate[] {
    const instances = importer.componentInstances;
    if (!instances) return [];

    const props: Candidate[] = [];

    for (const site of this.sitesIn(
      ref,
      importer,
      component,
      referrers,
      instances.via
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
        callSites: new WeakMap(),
        componentProps: new WeakMap(),
      };
    }

    return this.cache;
  }

  private dependents(): Dependents {
    const generation = this.modules.generation();

    if (this.dependentsCache?.generation !== generation) {
      this.dependentsCache = {
        generation,
        dependents: dependentsOf(this.modules.links()),
      };
    }

    return this.dependentsCache.dependents;
  }

  private referrersOf(exported: ExportedNames): Referrers {
    const dependents = this.dependents();
    const { exporters, exportedAs } = reexportsOf(exported, dependents);

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
      ? [...dependents.loadingOrder.keys()].map(parseRefKey)
      : importersOf(exporters, exportedAs, dependents);

    return { modules, globals, exporters, exportedAs };
  }

  /** The sites in `importer` that refer to `exported`; what they pass records `importer` in its resolution. */
  private sitesIn(
    ref: ModuleRef,
    importer: ModuleRecord,
    exported: ExportedNames,
    referrers: Referrers,
    kind: SiteKind
  ): SiteHandle[] {
    const imports = valueImports(importer.program);
    if (imports.length === 0 && referrers.globals.length === 0) return [];

    const scope = this.modules.scopeOf(importer);
    const index = sitesOfKind(kind, importer.program, scope);
    const sites: CallSite[] = [];

    for (const { declaration } of referrers.globals) {
      sites.push(...(index.byDeclaration.get(declaration) ?? []));
    }

    for (const statement of imports) {
      sites.push(
        ...this.sitesOfImport(statement, importer, index, exported, referrers)
      );
    }

    return sites.map((site) => this.importedSite(ref, kind, site));
  }

  /** Found again by its position: the handle does not hold the module. */
  private importedSite(
    ref: ModuleRef,
    kind: SiteKind,
    site: CallSite
  ): SiteHandle {
    const position = sitePosition(site);

    return {
      type: site.type,
      imported: true,
      resolve: () => {
        const module = this.modules.module(ref);
        if (!module) return undefined;

        const scope = this.modules.scopeOf(module);
        return sitesOfKind(kind, module.program, scope).byPosition.get(
          position
        );
      },
    };
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

    const record = this.modules.record(file);
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

function dependentsOf(
  modules: Iterable<{ ref: ModuleRef; links: Links }>
): Dependents {
  const dependents: Dependents = {
    loadingOrder: new Map(),
    links: new Map(),
    importers: new Map(),
    namespaceImporters: new Map(),
    reexporters: new Map(),
  };

  for (const { ref, links } of modules) {
    const key = refKey(ref);
    dependents.loadingOrder.set(key, dependents.loadingOrder.size);
    dependents.links.set(key, links);

    const { importedNames, importedNamespaces, reexported } = links;

    for (const [file, names] of importedNames) {
      const importersByName = getOrCreate(
        dependents.importers,
        file,
        () => new Map()
      );
      for (const name of names) append(importersByName, name, ref);
    }

    for (const file of importedNamespaces)
      append(dependents.namespaceImporters, file, ref);
    for (const file of reexported) append(dependents.reexporters, file, ref);
  }

  return dependents;
}

function importersOf(
  exporters: ReadonlySet<string>,
  exportedAs: ReadonlySet<string>,
  { importers, namespaceImporters, loadingOrder }: Dependents
): ModuleRef[] {
  const found = new Map<string, ModuleRef>();

  for (const file of exporters) {
    const importersByName = importers.get(file);
    const ofNamespace = namespaceImporters.get(file) ?? [];
    const ofNames = [...exportedAs].flatMap(
      (name) => importersByName?.get(name) ?? []
    );

    for (const importer of [...ofNamespace, ...ofNames])
      found.set(refKey(importer), importer);
  }

  const order = (ref: ModuleRef) => loadingOrder.get(refKey(ref))!;

  return [...found.values()].sort((a, b) => order(a) - order(b));
}

function reexportsOf(
  { file, names }: ExportedNames,
  { reexporters, links }: Dependents
): { exporters: Set<string>; exportedAs: Set<string> } {
  const exporters = new Set([file]);
  const renames: Rename[] = [];

  // Grows while it is iterated: re-exports of re-exports.
  for (const exporter of exporters) {
    for (const ref of reexporters.get(exporter) ?? []) {
      if (exporters.has(ref.file)) continue;

      exporters.add(ref.file);
      renames.push(...links.get(refKey(ref))!.renames);
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

function refKey({ file, part }: ModuleRef): string {
  return `${part}\0${file}`;
}

function parseRefKey(key: string): ModuleRef {
  const separator = key.indexOf('\0');

  return {
    file: key.slice(separator + 1),
    part: Number(key.slice(0, separator)),
  };
}

/** The links of a loaded module, read from its syntax tree. */
export function linksOf(record: ModuleRecord): Links {
  let links = linksOfRecords.get(record);

  if (!links) {
    links = resolveLinks(specifierLinks(record.program), record.resolved);
    linksOfRecords.set(record, links);
  }

  return links;
}

/** What a program imports and re-exports, by specifier. */
export function specifierLinks(program: ESTree.Program): SpecifierLinks {
  const links: SpecifierLinks = [];

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      if (statement.importKind === 'type') continue;

      const names: string[] = [];
      let namespace = false;

      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') namespace = true;
        else names.push(importedName(specifier));
      }

      links.push({
        type: 'import',
        source: statement.source.value,
        names,
        namespace,
      });
    } else if (statement.type === 'ExportAllDeclaration') {
      // `export * as ns` exports a namespace, not the module's exports.
      if (statement.exported) continue;

      links.push({ type: 'star', source: statement.source.value });
    } else if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.exportKind !== 'type'
    ) {
      for (const specifier of statement.specifiers) {
        const local = moduleExportName(specifier.local);
        const imported = statement.source
          ? { source: statement.source.value, name: local }
          : importOf(program, local);
        if (!imported) continue;

        links.push({
          type: 'reexport',
          source: imported.source,
          name: imported.name,
          exported: moduleExportName(specifier.exported),
        });
      }
    }
  }

  return links;
}

/** `links` with each specifier replaced by the file it resolves to; unresolved ones are left out. */
export function resolveLinks(
  links: SpecifierLinks,
  resolved: ReadonlyMap<string, string | undefined>
): Links {
  const found: Links = {
    importedNames: new Map(),
    importedNamespaces: new Set(),
    reexported: new Set(),
    renames: [],
  };

  for (const link of links) {
    const file = resolved.get(link.source);
    if (file === undefined) continue;

    switch (link.type) {
      case 'import': {
        if (link.namespace) found.importedNamespaces.add(file);
        if (link.names.length === 0) break;

        const names = getOrCreate(
          found.importedNames,
          file,
          () => new Set<string>()
        );
        for (const name of link.names) names.add(name);
        break;
      }
      case 'star':
        found.reexported.add(file);
        break;
      case 'reexport':
        found.reexported.add(file);
        found.renames.push({ imported: link.name, exported: link.exported });
        break;
    }
  }

  return found;
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
  map: Map<string, ModuleRef[]>,
  key: string,
  ref: ModuleRef
): void {
  getOrCreate(map, key, () => []).push(ref);
}

const exportNamesByScope = new WeakMap<Scope, Map<Node, string[]>>();

/** `export function f`, `export { f as g }`, `export default f` */
function exportNamesOf(
  program: ESTree.Program,
  fn: FunctionNode,
  scope: Scope
): readonly string[] {
  let byDeclaration = exportNamesByScope.get(scope);

  if (!byDeclaration) {
    byDeclaration = exportNamesByDeclaration(program, scope);
    exportNamesByScope.set(scope, byDeclaration);
  }

  return byDeclaration.get(fn) ?? [];
}

/** Read once per module: a module has many functions, and each would read every export. */
function exportNamesByDeclaration(
  program: ESTree.Program,
  scope: Scope
): Map<Node, string[]> {
  const names = new Map<Node, string[]>();

  const add = (declaration: Node | undefined, name: string) => {
    if (declaration) getOrCreate(names, declaration, () => []).push(name);
  };
  const declarationOf = (local: string) => scope.bindingOf(local)?.declaration;

  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const value = unwrapExpression(statement.declaration);
      const declaration =
        value.type === 'Identifier' ? declarationOf(value.name) : value;
      add(declaration, 'default');
      continue;
    }

    if (statement.type !== 'ExportNamedDeclaration' || statement.source)
      continue;

    const declared = statement.declaration
      ? declaredNames(statement.declaration)
      : [];
    for (const name of declared) add(declarationOf(name), name);

    for (const specifier of statement.specifiers) {
      add(
        declarationOf(moduleExportName(specifier.local)),
        moduleExportName(specifier.exported)
      );
    }
  }

  return names;
}

function sitesOfKind(
  kind: SiteKind,
  program: ESTree.Program,
  scope: Scope
): CallSiteIndex {
  return kind === 'call-sites'
    ? callSitesIn(program, scope)
    : componentInstancesIn(program, scope, kind);
}
