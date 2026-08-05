import fs from 'node:fs';
import path from 'node:path';
import traverseModule, { type Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import type { VueExtractionOptions } from '../../types.js';
import { parseScriptAst } from './parser.js';

const traverse = traverseModule.default || traverseModule;

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.cts',
  '.cjs',
  '.vue',
] as const;

const GT_EXPORT_NAMES = [
  'T',
  'Var',
  'Num',
  'DateTime',
  'Currency',
  'Plural',
  'Branch',
  'msg',
  'useGT',
  'useMessages',
] as const;

const VUE_EXPORT_NAMES = [
  'Suspense',
  'computed',
  'createVNode',
  'defineComponent',
  'defineAsyncComponent',
  'Fragment',
  'h',
  'markRaw',
  'reactive',
  'readonly',
  'ref',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'toRaw',
  'unref',
] as const;

type ExternalModuleName = 'gt-vue' | 'vue';

type DeclaredExport =
  | { type: 'expression'; node: t.Node }
  | { type: 'local'; name: string }
  | { type: 'namespace'; source: string }
  | { type: 'reexport'; importedName: string; source: string };

type ImportedBinding = {
  importedName: string | '*';
  source: string;
};

/** One parsed local source module used exclusively for static analysis. */
export type LocalModuleRecord = {
  ast: t.File;
  explicitExports: Map<string, DeclaredExport | 'ambiguous'>;
  filePath: string;
  imports: Map<string, ImportedBinding>;
  programScope: Scope;
  starExports: string[];
};

/** A statically resolved ESM export without executing project code. */
export type LocalExportTarget =
  | {
      exportName: string;
      originKey: string;
      record: LocalModuleRecord;
      type: 'local';
    }
  | {
      node: t.Node;
      originKey: string;
      record: LocalModuleRecord;
      type: 'expression';
    }
  | {
      exportName: string;
      originKey: string;
      source: ExternalModuleName;
      type: 'external';
    }
  | {
      originKey: string;
      source: ExternalModuleName;
      type: 'external-namespace';
    }
  | {
      modulePath: string;
      originKey: string;
      type: 'namespace';
    };

/** Result of resolving one named export through a local ESM graph. */
export type LocalExportResolution =
  | { status: 'absent' | 'ambiguous' | 'invalid' }
  | { status: 'resolved'; target: LocalExportTarget };

/** Read-only local source resolver used by the Vue script analyzer. */
export type LocalModuleResolver = {
  getRecord(filePath: string): LocalModuleRecord | undefined;
  /** Whether the caller supplied project-specific bare-specifier semantics. */
  hasCustomResolver: boolean;
  listExportNames(filePath: string): string[];
  resolveExport(filePath: string, exportName: string): LocalExportResolution;
  resolveModule(importer: string, specifier: string): string | undefined;
};

/**
 * Creates a cycle-safe ESM resolver for local source files and index barrels.
 *
 * The resolver reads and parses source text but never imports or executes it.
 * Bare aliases are accepted only through the caller's explicit resolver hook.
 */
export function createLocalModuleResolver(
  resolveModuleOption: VueExtractionOptions['resolveModule']
): LocalModuleResolver {
  const records = new Map<string, LocalModuleRecord | null>();
  const resolutions = new Map<string, LocalExportResolution>();

  const resolveModule = (
    importer: string,
    specifier: string
  ): string | undefined => {
    if (specifier === 'gt-vue' || specifier === 'vue') return undefined;
    let requested: string | undefined;
    if (resolveModuleOption) {
      try {
        const resolved = resolveModuleOption(specifier, importer);
        requested = resolved
          ? path.isAbsolute(resolved)
            ? resolved
            : path.resolve(path.dirname(importer), resolved)
          : undefined;
      } catch {
        // A project resolver is advisory. Relative paths retain the safe,
        // filesystem-only fallback below when the hook cannot resolve them.
      }
    }
    if (
      !requested &&
      (specifier.startsWith('.') || path.isAbsolute(specifier))
    ) {
      requested = path.isAbsolute(specifier)
        ? specifier
        : path.resolve(path.dirname(importer), specifier);
    }
    return requested ? resolveSourceFile(requested) : undefined;
  };

  const getRecord = (filePath: string): LocalModuleRecord | undefined => {
    const normalized = path.resolve(filePath);
    const cached = records.get(normalized);
    if (cached !== undefined) return cached ?? undefined;
    // The sentinel also makes self-imports and parse-time cycles fail closed.
    records.set(normalized, null);
    const parsed = parseLocalModule(normalized);
    records.set(normalized, parsed ?? null);
    return parsed;
  };

  const resolveExportInternal = (
    filePath: string,
    exportName: string,
    seen: Set<string>
  ): LocalExportResolution => {
    const normalized = path.resolve(filePath);
    const cycleKey = `${normalized}\0${exportName}`;
    if (seen.has(cycleKey)) return { status: 'absent' };
    const record = getRecord(normalized);
    if (!record) return { status: 'invalid' };
    const nextSeen = new Set(seen).add(cycleKey);
    const explicit = record.explicitExports.get(exportName);
    if (explicit === 'ambiguous') return { status: 'ambiguous' };
    if (explicit) {
      return resolveDeclaredExport(record, exportName, explicit, nextSeen);
    }
    if (exportName === 'default') return { status: 'absent' };

    const candidates: LocalExportTarget[] = [];
    let invalid = false;
    for (const source of record.starExports) {
      const candidate = resolveFromSource(record, source, exportName, nextSeen);
      if (candidate.status === 'resolved') candidates.push(candidate.target);
      if (candidate.status === 'ambiguous') return candidate;
      if (candidate.status === 'invalid') invalid = true;
    }
    if (candidates.length === 0) {
      return { status: invalid ? 'invalid' : 'absent' };
    }
    const origins = new Set(candidates.map(({ originKey }) => originKey));
    return origins.size === 1
      ? { status: 'resolved', target: candidates[0]! }
      : { status: 'ambiguous' };
  };

  const resolveFromSource = (
    record: LocalModuleRecord,
    source: string,
    exportName: string,
    seen: Set<string>
  ): LocalExportResolution => {
    if (isExternalModule(source)) {
      return knownExternalExport(source, exportName)
        ? {
            status: 'resolved',
            target: {
              exportName,
              originKey: `${source}#${exportName}`,
              source,
              type: 'external',
            },
          }
        : { status: 'absent' };
    }
    const modulePath = resolveModule(record.filePath, source);
    return modulePath
      ? resolveExportInternal(modulePath, exportName, seen)
      : { status: 'invalid' };
  };

  const resolveDeclaredExport = (
    record: LocalModuleRecord,
    exportName: string,
    declared: DeclaredExport,
    seen: Set<string>
  ): LocalExportResolution => {
    if (declared.type === 'reexport') {
      return resolveFromSource(
        record,
        declared.source,
        declared.importedName,
        seen
      );
    }
    if (declared.type === 'namespace') {
      if (isExternalModule(declared.source)) {
        return {
          status: 'resolved',
          target: {
            originKey: `${declared.source}#namespace`,
            source: declared.source,
            type: 'external-namespace',
          },
        };
      }
      const modulePath = resolveModule(record.filePath, declared.source);
      return modulePath
        ? {
            status: 'resolved',
            target: {
              modulePath,
              originKey: `${modulePath}#namespace`,
              type: 'namespace',
            },
          }
        : { status: 'invalid' };
    }
    if (declared.type === 'local') {
      const imported = record.imports.get(declared.name);
      if (imported) {
        if (imported.importedName === '*') {
          if (isExternalModule(imported.source)) {
            return {
              status: 'resolved',
              target: {
                originKey: `${imported.source}#namespace`,
                source: imported.source,
                type: 'external-namespace',
              },
            };
          }
          const modulePath = resolveModule(record.filePath, imported.source);
          return modulePath
            ? {
                status: 'resolved',
                target: {
                  modulePath,
                  originKey: `${modulePath}#namespace`,
                  type: 'namespace',
                },
              }
            : { status: 'invalid' };
        }
        return resolveFromSource(
          record,
          imported.source,
          imported.importedName,
          seen
        );
      }
      return {
        status: 'resolved',
        target: {
          exportName: declared.name,
          originKey: `${record.filePath}#local:${declared.name}`,
          record,
          type: 'local',
        },
      };
    }
    return {
      status: 'resolved',
      target: {
        node: declared.node,
        originKey: `${record.filePath}#expression:${exportName}`,
        record,
        type: 'expression',
      },
    };
  };

  const resolveExport = (
    filePath: string,
    exportName: string
  ): LocalExportResolution => {
    const cacheKey = `${path.resolve(filePath)}\0${exportName}`;
    const cached = resolutions.get(cacheKey);
    if (cached) return cached;
    const result = resolveExportInternal(filePath, exportName, new Set());
    resolutions.set(cacheKey, result);
    return result;
  };

  const listExportNames = (filePath: string): string[] => {
    return [...collectExportNames(filePath, new Set())].sort();
  };

  const collectExportNames = (
    filePath: string,
    seen: Set<string>
  ): Set<string> => {
    const normalized = path.resolve(filePath);
    if (seen.has(normalized)) return new Set();
    const record = getRecord(normalized);
    if (!record) return new Set();
    const nextSeen = new Set(seen).add(normalized);
    const names = new Set(record.explicitExports.keys());
    for (const source of record.starExports) {
      if (source === 'gt-vue') {
        for (const name of GT_EXPORT_NAMES) names.add(name);
      } else if (source === 'vue') {
        for (const name of VUE_EXPORT_NAMES) names.add(name);
      } else {
        const modulePath = resolveModule(record.filePath, source);
        if (!modulePath) continue;
        for (const name of collectExportNames(modulePath, nextSeen)) {
          if (name !== 'default') names.add(name);
        }
      }
    }
    return names;
  };

  return {
    getRecord,
    hasCustomResolver: resolveModuleOption !== undefined,
    listExportNames,
    resolveExport,
    resolveModule,
  };
}

function resolveSourceFile(requested: string): string | undefined {
  const candidates: string[] = [requested];
  const extension = path.extname(requested).toLowerCase();
  if (!extension) {
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(`${requested}${sourceExtension}`);
    }
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(path.join(requested, `index${sourceExtension}`));
    }
  } else if (['.js', '.jsx', '.mjs'].includes(extension)) {
    const base = requested.slice(0, -extension.length);
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(`${base}${sourceExtension}`);
    }
  }
  return candidates.find(isReadableFile);
}

function isReadableFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function parseLocalModule(filePath: string): LocalModuleRecord | undefined {
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  const extension = path.extname(filePath).toLowerCase();
  // Node treats these extensions as CommonJS regardless of package metadata.
  // Parsing ESM-looking syntax here would prove an identity the application
  // cannot actually import with ESM semantics, so both formats fail closed.
  if (extension === '.cjs' || extension === '.cts') return undefined;
  let language = extension.slice(1);
  if (extension === '.mjs') language = 'js';
  if (extension === '.mts') language = 'ts';
  // A local .vue module must be parsed with the consuming application's exact
  // compiler. The extractor deliberately fails closed here instead of
  // reintroducing a bundled-compiler mismatch through barrel resolution.
  if (extension === '.vue') return undefined;
  if (!['js', 'jsx', 'ts', 'tsx'].includes(language)) return undefined;

  let ast: t.File;
  try {
    ast = parseScriptAst(source, language);
  } catch {
    return undefined;
  }
  let programScope: Scope | undefined;
  traverse(ast, {
    Program(programPath) {
      programScope = programPath.scope;
      programPath.stop();
    },
  });
  if (!programScope) return undefined;

  const record: LocalModuleRecord = {
    ast,
    explicitExports: new Map(),
    filePath,
    imports: collectImportedBindings(ast),
    programScope,
    starExports: [],
  };
  collectExports(record);
  return record;
}

function collectImportedBindings(ast: t.File): Map<string, ImportedBinding> {
  const imports = new Map<string, ImportedBinding>();
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type'
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type'
      ) {
        imports.set(specifier.local.name, {
          importedName:
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value,
          source: statement.source.value,
        });
      } else if (specifier.type === 'ImportDefaultSpecifier') {
        imports.set(specifier.local.name, {
          importedName: 'default',
          source: statement.source.value,
        });
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        imports.set(specifier.local.name, {
          importedName: '*',
          source: statement.source.value,
        });
      }
    }
  }
  return imports;
}

function collectExports(record: LocalModuleRecord): void {
  for (const statement of record.ast.program.body) {
    if (statement.type === 'ExportAllDeclaration') {
      if (statement.exportKind !== 'type') {
        record.starExports.push(statement.source.value);
      }
      continue;
    }
    if (statement.type === 'ExportDefaultDeclaration') {
      addExplicitExport(record, 'default', {
        node: statement.declaration,
        type: 'expression',
      });
      continue;
    }
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.exportKind === 'type'
    ) {
      continue;
    }
    if (statement.declaration) {
      for (const name of declaredNames(statement.declaration)) {
        addExplicitExport(record, name, { name, type: 'local' });
      }
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ExportSpecifier' &&
        specifier.exportKind === 'type'
      ) {
        continue;
      }
      const exportedName =
        specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : specifier.exported.value;
      if (specifier.type === 'ExportNamespaceSpecifier') {
        if (statement.source) {
          addExplicitExport(record, exportedName, {
            source: statement.source.value,
            type: 'namespace',
          });
        }
        continue;
      }
      if (specifier.type !== 'ExportSpecifier') continue;
      const localName = specifier.local.name;
      addExplicitExport(
        record,
        exportedName,
        statement.source
          ? {
              importedName: localName,
              source: statement.source.value,
              type: 'reexport',
            }
          : { name: localName, type: 'local' }
      );
    }
  }
}

function addExplicitExport(
  record: LocalModuleRecord,
  name: string,
  value: DeclaredExport
): void {
  record.explicitExports.set(
    name,
    record.explicitExports.has(name) ? 'ambiguous' : value
  );
}

function declaredNames(declaration: t.Declaration): string[] {
  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration'
  ) {
    return declaration.id ? [declaration.id.name] : [];
  }
  if (declaration.type !== 'VariableDeclaration') return [];
  return declaration.declarations.flatMap(({ id }) => patternNames(id));
}

function patternNames(pattern: t.Node): string[] {
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') return patternNames(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return patternNames(pattern.left);
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.flatMap((element) =>
      element ? patternNames(element) : []
    );
  }
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((property) =>
      property.type === 'RestElement'
        ? patternNames(property.argument)
        : patternNames(property.value)
    );
  }
  return [];
}

function isExternalModule(source: string): source is ExternalModuleName {
  return source === 'gt-vue' || source === 'vue';
}

function knownExternalExport(
  source: ExternalModuleName,
  exportName: string
): boolean {
  return source === 'gt-vue'
    ? (GT_EXPORT_NAMES as readonly string[]).includes(exportName)
    : (VUE_EXPORT_NAMES as readonly string[]).includes(exportName);
}
