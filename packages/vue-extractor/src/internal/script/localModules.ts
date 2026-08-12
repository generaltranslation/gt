import fs from 'node:fs';
import path from 'node:path';
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import type * as t from '@babel/types';
import {
  initSync as initModuleLexer,
  parse as parseModuleImports,
} from 'es-module-lexer';
import type { VueExtractionOptions } from '../../types.js';
import { parseScriptAst } from './parser.js';
import { isKnownNonVueGTRuntime } from './runtimeModules.js';

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

/** Complete public value surface currently exported by the gt-vue runtime. */
const GT_RUNTIME_EXPORT_NAMES = [
  ...GT_EXPORT_NAMES,
  'createGT',
  'useLocale',
  'useSetLocale',
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

type RecoveredDeclaredExport = Extract<
  DeclaredExport,
  { type: 'namespace' | 'reexport' }
>;

type RecoveredModuleRecord = {
  explicitExports: Map<string, RecoveredDeclaredExport | 'ambiguous'>;
  filePath: string;
  starExports: string[];
};

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
      /** A statically proven export from an official non-Vue GT runtime. */
      originKey: string;
      type: 'ordinary-external';
    }
  | {
      modulePath: string;
      originKey: string;
      type: 'namespace';
    };

/** Result of resolving one named export through a local ESM graph. */
export type LocalExportResolution =
  | { status: 'absent' | 'ambiguous' }
  | {
      gtExportName?: string | '*';
      hasGTSourceReference?: boolean;
      /** Fully resolved targets recovered from an otherwise invalid module. */
      recoveredTargets?: LocalExportTarget[];
      status: 'invalid';
    }
  | { status: 'resolved'; target: LocalExportTarget };

/** Read-only local source resolver used by the Vue script analyzer. */
export type LocalModuleResolver = {
  getRecord(filePath: string): LocalModuleRecord | undefined;
  /** Returns the exact GT leaf behind an export, excluding namespace containers. */
  getGTExportName(
    filePath: string,
    exportName: string
  ): string | '*' | undefined;
  /** Whether the caller supplied project-specific bare-specifier semantics. */
  hasCustomResolver: boolean;
  /** Whether a resolved module belongs to project source rather than an install. */
  isProjectModule(filePath: string): boolean;
  listExportNames(filePath: string): string[];
  /** Whether a named export is statically connected to the gt-vue runtime. */
  hasGTExportReference(filePath: string, exportName: string): boolean;
  resolveExport(filePath: string, exportName: string): LocalExportResolution;
  resolveModule(importer: string, specifier: string): string | undefined;
};

/** Package-provenance behavior that is broader than source extraction. */
export type LocalModuleResolverOptions = {
  /** Includes gt-vue setup and locale APIs that extraction never calls. */
  recognizeAllGTRuntimeExports?: boolean;
};

/**
 * Creates a cycle-safe ESM resolver for local source files and index barrels.
 *
 * The resolver reads and parses source text but never imports or executes it.
 * Bare aliases are accepted only through the caller's explicit resolver hook.
 */
export function createLocalModuleResolver(
  resolveModuleOption: VueExtractionOptions['resolveModule'],
  options: LocalModuleResolverOptions = {}
): LocalModuleResolver {
  const records = new Map<string, LocalModuleRecord | null>();
  const recoveredRecords = new Map<string, RecoveredModuleRecord | null>();
  const resolutions = new Map<string, LocalExportResolution>();
  const recordPaths = new WeakMap<
    LocalModuleRecord,
    WeakMap<t.Node, NodePath<t.Node>>
  >();

  const isProjectModule = (filePath: string): boolean => {
    const realPath = readRealPath(path.resolve(filePath));
    // The caller's resolver contract accepts local workspace source even when
    // it sits above the metadata project root. Resolve symlinks before checking
    // the package boundary so linked workspaces remain local while installed
    // package implementations stay opaque.
    return !realPath.split(path.sep).includes('node_modules');
  };

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
    if (!isProjectModule(normalized)) return undefined;
    const cached = records.get(normalized);
    if (cached !== undefined) return cached ?? undefined;
    // The sentinel also makes self-imports and parse-time cycles fail closed.
    records.set(normalized, null);
    const parsed = parseLocalModule(normalized);
    records.set(normalized, parsed ?? null);
    return parsed;
  };

  const getRecoveredRecord = (
    filePath: string
  ): RecoveredModuleRecord | undefined => {
    const normalized = path.resolve(filePath);
    if (!isProjectModule(normalized)) return undefined;
    const cached = recoveredRecords.get(normalized);
    if (cached !== undefined) return cached ?? undefined;
    const recovered = recoverMalformedModuleExports(normalized);
    recoveredRecords.set(normalized, recovered ?? null);
    return recovered;
  };

  const resolveExportInternal = (
    filePath: string,
    exportName: string,
    seen: Set<string>
  ): LocalExportResolution => {
    const normalized = path.resolve(filePath);
    if (!isProjectModule(normalized)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${normalized}#${exportName}`,
          type: 'ordinary-external',
        },
      };
    }
    const cycleKey = `${normalized}\0${exportName}`;
    if (seen.has(cycleKey)) return { status: 'absent' };
    const nextSeen = new Set(seen).add(cycleKey);
    const record = getRecord(normalized);
    if (!record) {
      const recovered = getRecoveredRecord(normalized);
      return recovered
        ? resolveRecoveredExport(recovered, exportName, nextSeen)
        : { status: 'invalid' };
    }
    const explicit = record.explicitExports.get(exportName);
    if (explicit === 'ambiguous') return { status: 'ambiguous' };
    if (explicit) {
      return resolveDeclaredExport(record, exportName, explicit, nextSeen);
    }
    if (exportName === 'default') return { status: 'absent' };

    const candidates: LocalExportTarget[] = [];
    let ambiguous = false;
    let invalid = false;
    let invalidGTExportName: string | '*' | undefined;
    let invalidGTSourceReference = false;
    let recoveredTargets: LocalExportTarget[] | undefined = [];
    for (const source of record.starExports) {
      const candidate = resolveFromSource(record, source, exportName, nextSeen);
      if (candidate.status === 'absent') continue;
      const candidateGTExportName = readGTExportName(candidate, nextSeen);
      invalidGTSourceReference ||= candidateGTExportName !== undefined;
      invalidGTExportName ??= candidateGTExportName;
      if (candidate.status === 'resolved') {
        candidates.push(candidate.target);
        recoveredTargets?.push(candidate.target);
      }
      if (candidate.status === 'ambiguous') {
        ambiguous = true;
        recoveredTargets = undefined;
      }
      if (candidate.status === 'invalid') {
        invalid = true;
        invalidGTSourceReference ||= candidate.hasGTSourceReference === true;
        invalidGTExportName ??= candidate.gtExportName;
        if (recoveredTargets && candidate.recoveredTargets) {
          recoveredTargets.push(...candidate.recoveredTargets);
        } else {
          recoveredTargets = undefined;
        }
      }
    }
    const origins = new Set(candidates.map(({ originKey }) => originKey));
    if (origins.size > 1) {
      ambiguous = true;
      recoveredTargets = undefined;
    }
    if (
      recoveredTargets &&
      new Set(recoveredTargets.map(({ originKey }) => originKey)).size > 1
    ) {
      ambiguous = true;
      recoveredTargets = undefined;
    }
    if (invalid) {
      return {
        ...(invalidGTSourceReference && {
          hasGTSourceReference: true,
        }),
        ...(invalidGTExportName && {
          gtExportName: invalidGTExportName,
        }),
        ...(recoveredTargets?.length && {
          recoveredTargets: uniqueRecoveredTargets(recoveredTargets),
        }),
        status: 'invalid',
      };
    }
    if (ambiguous) return { status: 'ambiguous' };
    return candidates.length === 0
      ? { status: 'absent' }
      : { status: 'resolved', target: candidates[0]! };
  };

  const resolveRecoveredExport = (
    record: RecoveredModuleRecord,
    exportName: string,
    seen: Set<string>
  ): LocalExportResolution => {
    const explicit = record.explicitExports.get(exportName);
    if (explicit === 'ambiguous') return { status: 'ambiguous' };
    if (explicit) {
      const resolution =
        explicit.type === 'reexport'
          ? resolveFromSource(
              record,
              explicit.source,
              explicit.importedName,
              seen
            )
          : resolveRecoveredNamespace(record, explicit.source);
      return invalidateRecoveredResolution(resolution, seen);
    }
    if (exportName === 'default') return { status: 'invalid' };

    let gtExportName: string | '*' | undefined;
    let recoveredTargets: LocalExportTarget[] | undefined = [];
    for (const source of record.starExports) {
      const candidate = resolveFromSource(record, source, exportName, seen);
      if (candidate.status === 'absent') continue;
      gtExportName ??= readGTExportName(candidate, seen);
      if (recoveredTargets && candidate.status === 'resolved') {
        recoveredTargets.push(candidate.target);
      } else if (
        recoveredTargets &&
        candidate.status === 'invalid' &&
        candidate.recoveredTargets
      ) {
        recoveredTargets.push(...candidate.recoveredTargets);
      } else {
        recoveredTargets = undefined;
      }
    }
    if (
      recoveredTargets &&
      new Set(recoveredTargets.map(({ originKey }) => originKey)).size > 1
    ) {
      recoveredTargets = undefined;
    }
    return {
      ...(gtExportName && {
        gtExportName,
        hasGTSourceReference: true,
      }),
      ...(recoveredTargets?.length && {
        recoveredTargets: uniqueRecoveredTargets(recoveredTargets),
      }),
      status: 'invalid',
    };
  };

  const resolveRecoveredNamespace = (
    record: RecoveredModuleRecord,
    source: string
  ): LocalExportResolution => {
    if (isKnownNonVueGTRuntime(source)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${source}#namespace`,
          type: 'ordinary-external',
        },
      };
    }
    if (isExternalModule(source)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${source}#namespace`,
          source,
          type: 'external-namespace',
        },
      };
    }
    const modulePath = resolveModule(record.filePath, source);
    if (!modulePath) return { status: 'invalid' };
    if (!isProjectModule(modulePath)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${modulePath}#namespace`,
          type: 'ordinary-external',
        },
      };
    }
    return {
      status: 'resolved',
      target: {
        modulePath,
        originKey: `${modulePath}#namespace`,
        type: 'namespace',
      },
    };
  };

  const invalidateRecoveredResolution = (
    resolution: LocalExportResolution,
    seen: Set<string>
  ): LocalExportResolution => {
    const gtExportName = readGTExportName(resolution, seen);
    return {
      ...(gtExportName && {
        gtExportName,
        hasGTSourceReference: true,
      }),
      ...(resolution.status === 'resolved'
        ? { recoveredTargets: [resolution.target] }
        : resolution.status === 'invalid' && resolution.recoveredTargets
          ? { recoveredTargets: resolution.recoveredTargets }
          : {}),
      status: 'invalid',
    };
  };

  const readGTExportName = (
    resolution: LocalExportResolution,
    seen: Set<string>,
    allowNamespaceContainers = true
  ): string | '*' | undefined => {
    if (resolution.status === 'invalid') {
      return allowNamespaceContainers || resolution.gtExportName !== '*'
        ? resolution.gtExportName
        : undefined;
    }
    if (resolution.status !== 'resolved') return undefined;
    const { target } = resolution;
    if (target.type === 'external') {
      return target.source === 'gt-vue' ? target.exportName : undefined;
    }
    if (target.type === 'external-namespace') {
      return allowNamespaceContainers && target.source === 'gt-vue'
        ? '*'
        : undefined;
    }
    if (target.type === 'namespace') {
      if (!allowNamespaceContainers) return undefined;
      const candidateNames = options.recognizeAllGTRuntimeExports
        ? [...GT_RUNTIME_EXPORT_NAMES]
        : [...GT_EXPORT_NAMES];
      return candidateNames.some((name) =>
        Boolean(
          readGTExportName(
            resolveExportInternal(target.modulePath, name, seen),
            seen,
            allowNamespaceContainers
          )
        )
      )
        ? '*'
        : undefined;
    }
    if (target.type === 'ordinary-external') return undefined;
    const state: DerivedGTState = {
      bindings: new Set(),
      nodes: new Set(),
      record: target.record,
      resolutions: seen,
      allowNamespaceContainers,
    };
    if (target.type === 'expression') {
      return readDerivedGT(target.node, state);
    }
    const binding = target.record.programScope.getBinding(target.exportName);
    return binding ? readDerivedGTBinding(binding, state) : undefined;
  };

  type DerivedGTState = {
    allowNamespaceContainers: boolean;
    bindings: Set<Binding>;
    nodes: Set<t.Node>;
    record: LocalModuleRecord;
    resolutions: Set<string>;
  };

  /** Lazily indexes lexical paths only when package provenance needs them. */
  const readNodePath = (
    record: LocalModuleRecord,
    node: t.Node
  ): NodePath<t.Node> | undefined => {
    let paths = recordPaths.get(record);
    if (!paths) {
      paths = new WeakMap();
      traverse(record.ast, {
        enter(nodePath) {
          paths!.set(nodePath.node, nodePath as NodePath<t.Node>);
        },
      });
      recordPaths.set(record, paths);
    }
    return paths.get(node);
  };

  /** Rejects a namespace member whose value is overwritten in this module. */
  const namespaceMemberIsWritten = (
    binding: Binding,
    exportName: string
  ): boolean => {
    return binding.referencePaths.some((reference) => {
      const member = reference.parentPath;
      if (
        (!member?.isMemberExpression() &&
          !member?.isOptionalMemberExpression()) ||
        member.node.object !== reference.node ||
        readStaticMemberName(member.node) !== exportName
      ) {
        return false;
      }
      const parent = member.parentPath?.node;
      return Boolean(
        (parent?.type === 'AssignmentExpression' &&
          parent.left === member.node) ||
        (parent?.type === 'UpdateExpression' &&
          parent.argument === member.node) ||
        (parent?.type === 'UnaryExpression' &&
          parent.operator === 'delete' &&
          parent.argument === member.node) ||
        ((parent?.type === 'ForInStatement' ||
          parent?.type === 'ForOfStatement') &&
          parent.left === member.node)
      );
    });
  };

  /** Follows immutable aliases while rejecting mutation and lexical shadows. */
  const readDerivedGTBinding = (
    binding: Binding,
    state: DerivedGTState
  ): string | '*' | undefined => {
    if (!binding.constant || state.bindings.has(binding)) return undefined;
    const next = {
      ...state,
      bindings: new Set(state.bindings).add(binding),
    };
    if (binding.kind === 'module') {
      const imported = state.record.imports.get(binding.identifier.name);
      if (!imported) return undefined;
      if (imported.importedName === '*') {
        return state.allowNamespaceContainers && imported.source === 'gt-vue'
          ? '*'
          : undefined;
      }
      return readGTExportName(
        resolveFromSource(
          state.record,
          imported.source,
          imported.importedName,
          state.resolutions
        ),
        state.resolutions,
        state.allowNamespaceContainers
      );
    }
    const declaration = binding.path.node;
    if (declaration.type === 'VariableDeclarator') {
      if (declaration.id.type === 'Identifier') {
        return readDerivedGT(declaration.init, next);
      }
      return readDestructuredGTBinding(binding, declaration, next);
    }
    return declaration.type === 'FunctionDeclaration'
      ? readDerivedGT(declaration, next)
      : undefined;
  };

  /** Resolves one exact leaf destructured from a direct gt-vue namespace. */
  const readDestructuredGTBinding = (
    binding: Binding,
    declaration: t.VariableDeclarator,
    state: DerivedGTState
  ): string | undefined => {
    if (
      declaration.id.type !== 'ObjectPattern' ||
      declaration.id.properties.some(
        (property) => property.type === 'RestElement'
      )
    ) {
      return undefined;
    }
    const property = declaration.id.properties.find(
      (candidate): candidate is t.ObjectProperty =>
        candidate.type === 'ObjectProperty' &&
        !candidate.computed &&
        candidate.value.type === 'Identifier' &&
        candidate.value === binding.identifier
    );
    const exportName = property ? readStaticObjectKey(property) : undefined;
    if (
      !exportName ||
      !knownExternalExport(
        'gt-vue',
        exportName,
        options.recognizeAllGTRuntimeExports === true
      )
    ) {
      return undefined;
    }

    const namespace = unwrapLocalExpression(declaration.init);
    if (!namespace || namespace.type !== 'Identifier') return undefined;
    const namespaceBinding = readNodePath(
      state.record,
      namespace
    )?.scope.getBinding(namespace.name);
    const imported = namespaceBinding
      ? state.record.imports.get(namespaceBinding.identifier.name)
      : undefined;
    return namespaceBinding?.kind === 'module' &&
      namespaceBinding.constant &&
      imported?.source === 'gt-vue' &&
      imported.importedName === '*' &&
      !namespaceMemberIsWritten(namespaceBinding, exportName)
      ? exportName
      : undefined;
  };

  /** Resolves a direct gt-vue value, including immutable local aliases. */
  const readDirectGT = (
    node: t.Node | null | undefined,
    state: DerivedGTState
  ): string | '*' | undefined => {
    const expression = unwrapLocalExpression(node);
    if (!expression || state.nodes.has(expression)) return undefined;
    const next = { ...state, nodes: new Set(state.nodes).add(expression) };
    if (expression.type === 'Identifier') {
      const binding = readNodePath(state.record, expression)?.scope.getBinding(
        expression.name
      );
      return binding ? readDerivedGTBinding(binding, next) : undefined;
    }
    if (
      expression.type !== 'MemberExpression' &&
      expression.type !== 'OptionalMemberExpression'
    ) {
      return undefined;
    }
    const property = readStaticMemberName(expression);
    const object = unwrapLocalExpression(expression.object);
    if (!property || object?.type !== 'Identifier') return undefined;
    const binding = readNodePath(state.record, object)?.scope.getBinding(
      object.name
    );
    if (!binding || binding.kind !== 'module' || !binding.constant) {
      return undefined;
    }
    const imported = state.record.imports.get(binding.identifier.name);
    if (!imported || imported.importedName !== '*') return undefined;
    if (namespaceMemberIsWritten(binding, property)) return undefined;
    if (imported.source === 'gt-vue') {
      return knownExternalExport(
        imported.source,
        property,
        options.recognizeAllGTRuntimeExports === true
      )
        ? property
        : undefined;
    }
    const modulePath = resolveModule(state.record.filePath, imported.source);
    return modulePath && isProjectModule(modulePath)
      ? readGTExportName(
          resolveExportInternal(modulePath, property, state.resolutions),
          state.resolutions,
          state.allowNamespaceContainers
        )
      : undefined;
  };

  /** Recognizes only explicit aliases and Vue component wrapper forms. */
  const readDerivedGT = (
    node: t.Node | null | undefined,
    state: DerivedGTState
  ): string | '*' | undefined => {
    const direct = readDirectGT(node, state);
    if (direct) return direct;
    const expression = unwrapLocalExpression(node);
    if (!expression || state.nodes.has(expression)) return undefined;
    const next = { ...state, nodes: new Set(state.nodes).add(expression) };
    if (
      expression.type === 'ArrowFunctionExpression' ||
      expression.type === 'FunctionExpression' ||
      expression.type === 'FunctionDeclaration' ||
      expression.type === 'ObjectMethod'
    ) {
      return readFunctionRenderedGT(expression, next);
    }
    if (expression.type === 'ObjectExpression') {
      return readComponentObjectGT(expression, next);
    }
    if (
      (expression.type === 'CallExpression' ||
        expression.type === 'OptionalCallExpression') &&
      isVueHelper(expression.callee, state, 'defineComponent')
    ) {
      const component = expression.arguments[0];
      return component &&
        component.type !== 'SpreadElement' &&
        component.type !== 'ArgumentPlaceholder'
        ? readDerivedGT(component, next)
        : undefined;
    }
    return readRenderedGT(expression, state);
  };

  /** Checks only return values owned by the wrapper function itself. */
  const readFunctionRenderedGT = (
    fn: t.Function,
    state: DerivedGTState
  ): string | '*' | undefined => {
    if (
      fn.type === 'ArrowFunctionExpression' &&
      fn.body.type !== 'BlockStatement'
    ) {
      return readRenderedGT(fn.body, state);
    }
    const functionPath = readNodePath(state.record, fn);
    if (!functionPath) return undefined;
    let result: string | '*' | undefined;
    functionPath.traverse({
      ReturnStatement(returnPath) {
        if (result || returnPath.getFunctionParent()?.node !== fn) return;
        result = readRenderedGT(returnPath.node.argument, state);
      },
    });
    return result;
  };

  /** Checks the two component options that can directly produce rendered output. */
  const readComponentObjectGT = (
    object: t.ObjectExpression,
    state: DerivedGTState
  ): string | '*' | undefined => {
    for (const property of object.properties) {
      if (property.type === 'SpreadElement') continue;
      const name = readStaticObjectKey(property);
      if (name !== 'render' && name !== 'setup') continue;
      const value =
        property.type === 'ObjectProperty' ? property.value : property;
      const result = readDerivedGT(value, state);
      if (result) return result;
    }
    return undefined;
  };

  /** Recognizes GT only in returned JSX or the h/createVNode component slot. */
  const readRenderedGT = (
    node: t.Node | null | undefined,
    state: DerivedGTState
  ): string | '*' | undefined => {
    const expression = unwrapLocalExpression(node);
    if (!expression || state.nodes.has(expression)) return undefined;
    const next = { ...state, nodes: new Set(state.nodes).add(expression) };
    if (
      expression.type === 'ArrowFunctionExpression' ||
      expression.type === 'FunctionExpression'
    ) {
      return readFunctionRenderedGT(expression, next);
    }
    if (expression.type === 'JSXElement') {
      const component = readJSXComponentGT(
        expression.openingElement.name,
        next
      );
      if (component) return component;
      for (const child of expression.children) {
        const value =
          child.type === 'JSXExpressionContainer'
            ? child.expression.type === 'JSXEmptyExpression'
              ? undefined
              : child.expression
            : child;
        const result = readRenderedGT(value, next);
        if (result) return result;
      }
      return undefined;
    }
    if (expression.type === 'JSXFragment') {
      for (const child of expression.children) {
        const value =
          child.type === 'JSXExpressionContainer'
            ? child.expression.type === 'JSXEmptyExpression'
              ? undefined
              : child.expression
            : child;
        const result = readRenderedGT(value, next);
        if (result) return result;
      }
      return undefined;
    }
    if (expression.type === 'ConditionalExpression') {
      return (
        readRenderedGT(expression.consequent, next) ??
        readRenderedGT(expression.alternate, next)
      );
    }
    if (expression.type === 'LogicalExpression') {
      return (
        readRenderedGT(expression.left, next) ??
        readRenderedGT(expression.right, next)
      );
    }
    if (
      (expression.type !== 'CallExpression' &&
        expression.type !== 'OptionalCallExpression') ||
      (!isVueHelper(expression.callee, state, 'h') &&
        !isVueHelper(expression.callee, state, 'createVNode'))
    ) {
      return undefined;
    }
    const component = expression.arguments[0];
    return component &&
      component.type !== 'SpreadElement' &&
      component.type !== 'ArgumentPlaceholder'
      ? readDirectGT(component, next)
      : undefined;
  };

  /** Resolves an imported GT component used as a JSX element name. */
  const readJSXComponentGT = (
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
    state: DerivedGTState
  ): string | '*' | undefined => {
    if (name.type === 'JSXMemberExpression') {
      if (name.object.type !== 'JSXIdentifier') return undefined;
      const binding = readNodePath(state.record, name.object)?.scope.getBinding(
        name.object.name
      );
      if (!binding || binding.kind !== 'module' || !binding.constant) {
        return undefined;
      }
      const imported = state.record.imports.get(binding.identifier.name);
      if (!imported || imported.importedName !== '*') return undefined;
      const property = name.property.name;
      if (namespaceMemberIsWritten(binding, property)) return undefined;
      if (imported.source === 'gt-vue') {
        return knownExternalExport(
          imported.source,
          property,
          options.recognizeAllGTRuntimeExports === true
        )
          ? property
          : undefined;
      }
      const modulePath = resolveModule(state.record.filePath, imported.source);
      return modulePath && isProjectModule(modulePath)
        ? readGTExportName(
            resolveExportInternal(modulePath, property, state.resolutions),
            state.resolutions,
            state.allowNamespaceContainers
          )
        : undefined;
    }
    if (name.type !== 'JSXIdentifier' || /^[a-z]/.test(name.name)) return;
    const binding = readNodePath(state.record, name)?.scope.getBinding(
      name.name
    );
    return binding ? readDerivedGTBinding(binding, state) : undefined;
  };

  /** Matches a direct or namespace ESM import from Vue without evaluating calls. */
  const isVueHelper = (
    node: t.Node,
    state: DerivedGTState,
    exportName: 'createVNode' | 'defineComponent' | 'h'
  ): boolean => {
    const expression = unwrapLocalExpression(node);
    if (!expression) return false;
    const identifier =
      expression.type === 'Identifier'
        ? expression
        : (expression.type === 'MemberExpression' ||
              expression.type === 'OptionalMemberExpression') &&
            readStaticMemberName(expression) === exportName
          ? unwrapLocalExpression(expression.object)
          : undefined;
    if (!identifier || identifier.type !== 'Identifier') return false;
    const binding = readNodePath(state.record, identifier)?.scope.getBinding(
      identifier.name
    );
    const imported =
      binding?.kind === 'module'
        ? state.record.imports.get(binding.identifier.name)
        : undefined;
    const expectedImport = expression.type === 'Identifier' ? exportName : '*';
    return (
      binding?.constant === true &&
      imported?.source === 'vue' &&
      imported.importedName === expectedImport &&
      (expectedImport !== '*' || !namespaceMemberIsWritten(binding, exportName))
    );
  };

  const readStaticMemberName = (
    member: t.MemberExpression | t.OptionalMemberExpression
  ): string | undefined => {
    if (!member.computed && member.property.type === 'Identifier') {
      return member.property.name;
    }
    return member.computed && member.property.type === 'StringLiteral'
      ? member.property.value
      : undefined;
  };

  const readStaticObjectKey = (property: {
    computed?: boolean;
    key?: t.Node;
  }): string | undefined => {
    if (!property.key) return undefined;
    if (!property.computed && property.key.type === 'Identifier') {
      return property.key.name;
    }
    return property.key.type === 'StringLiteral'
      ? property.key.value
      : undefined;
  };

  const resolutionReferencesGT = (
    resolution: LocalExportResolution,
    seen: Set<string>
  ): boolean => {
    return readGTExportName(resolution, seen) !== undefined;
  };

  const resolveFromSource = (
    record: Pick<LocalModuleRecord, 'filePath'>,
    source: string,
    exportName: string,
    seen: Set<string>
  ): LocalExportResolution => {
    if (isKnownNonVueGTRuntime(source)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${source}#${exportName}`,
          type: 'ordinary-external',
        },
      };
    }
    if (isExternalModule(source)) {
      return knownExternalExport(
        source,
        exportName,
        options.recognizeAllGTRuntimeExports === true
      )
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
    if (!modulePath) return { status: 'invalid' };
    if (!isProjectModule(modulePath)) {
      return {
        status: 'resolved',
        target: {
          originKey: `${modulePath}#${exportName}`,
          type: 'ordinary-external',
        },
      };
    }
    return resolveExportInternal(modulePath, exportName, seen);
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
      if (isKnownNonVueGTRuntime(declared.source)) {
        return {
          status: 'resolved',
          target: {
            originKey: `${declared.source}#namespace`,
            type: 'ordinary-external',
          },
        };
      }
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
      if (modulePath && !isProjectModule(modulePath)) {
        return {
          status: 'resolved',
          target: {
            originKey: `${modulePath}#namespace`,
            type: 'ordinary-external',
          },
        };
      }
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
          if (isKnownNonVueGTRuntime(imported.source)) {
            return {
              status: 'resolved',
              target: {
                originKey: `${imported.source}#namespace`,
                type: 'ordinary-external',
              },
            };
          }
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
          if (modulePath && !isProjectModule(modulePath)) {
            return {
              status: 'resolved',
              target: {
                originKey: `${modulePath}#namespace`,
                type: 'ordinary-external',
              },
            };
          }
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
    const recovered = record ? undefined : getRecoveredRecord(normalized);
    if (!record && !recovered) return new Set();
    const moduleRecord = record ?? recovered!;
    const nextSeen = new Set(seen).add(normalized);
    const names = new Set(moduleRecord.explicitExports.keys());
    for (const source of moduleRecord.starExports) {
      if (source === 'gt-vue') {
        for (const name of GT_EXPORT_NAMES) names.add(name);
      } else if (source === 'vue') {
        for (const name of VUE_EXPORT_NAMES) names.add(name);
      } else if (isKnownNonVueGTRuntime(source)) {
        continue;
      } else {
        const modulePath = resolveModule(moduleRecord.filePath, source);
        if (!modulePath || !isProjectModule(modulePath)) continue;
        for (const name of collectExportNames(modulePath, nextSeen)) {
          if (name !== 'default') names.add(name);
        }
      }
    }
    return names;
  };

  const hasGTExportReference = (
    filePath: string,
    exportName: string
  ): boolean => {
    return resolutionReferencesGT(
      resolveExportInternal(filePath, exportName, new Set()),
      new Set()
    );
  };

  const getGTExportName = (
    filePath: string,
    exportName: string
  ): string | '*' | undefined => {
    const resolution = resolveExportInternal(filePath, exportName, new Set());
    return resolution.status === 'resolved'
      ? readGTExportName(resolution, new Set(), false)
      : undefined;
  };

  return {
    getRecord,
    getGTExportName,
    hasCustomResolver: resolveModuleOption !== undefined,
    hasGTExportReference,
    isProjectModule,
    listExportNames,
    resolveExport,
    resolveModule,
  };
}

/** Removes syntax-only wrappers without importing the compiler-facing utilities. */
function unwrapLocalExpression(
  input: t.Node | null | undefined
): t.Node | undefined {
  let current = input ?? undefined;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSInstantiationExpression' ||
      current.type === 'TypeCastExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

/** Deduplicates recovered graph targets without discarding their identities. */
function uniqueRecoveredTargets(
  targets: LocalExportTarget[]
): LocalExportTarget[] {
  return [
    ...new Map(targets.map((target) => [target.originKey, target])).values(),
  ];
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

/** Resolves symlinks when possible while retaining missing-path diagnostics. */
function readRealPath(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return filePath;
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

let moduleLexerInitialized = false;

/**
 * Recovers only source-bound runtime exports from an otherwise invalid module.
 *
 * The recovered declarations establish provenance, but never become executable
 * analyzer input. Their resolutions remain invalid so consumers fail closed
 * while type-only and unrelated module references stay invisible.
 */
function recoverMalformedModuleExports(
  filePath: string
): RecoveredModuleRecord | undefined {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.cjs' || extension === '.cts' || extension === '.vue') {
    return undefined;
  }
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  if (!moduleLexerInitialized) {
    initModuleLexer();
    moduleLexerInitialized = true;
  }
  let moduleImports: ReturnType<typeof parseModuleImports>[0];
  try {
    [moduleImports] = parseModuleImports(source);
  } catch {
    return undefined;
  }

  const record: RecoveredModuleRecord = {
    explicitExports: new Map(),
    filePath,
    starExports: [],
  };
  const statements = new Set<string>();
  for (const moduleImport of moduleImports) {
    if (
      moduleImport.d !== -1 ||
      moduleImport.ss < 0 ||
      moduleImport.se <= moduleImport.ss
    ) {
      continue;
    }
    statements.add(source.slice(moduleImport.ss, moduleImport.se));
  }

  for (const statementSource of statements) {
    const statement = parseRecoveredModuleStatement(statementSource, extension);
    if (!statement) continue;
    collectRecoveredExport(record, statement);
  }
  return record.explicitExports.size > 0 || record.starExports.length > 0
    ? record
    : undefined;
}

/** Parses one lexed declaration under the source file's supported grammars. */
function parseRecoveredModuleStatement(
  source: string,
  extension: string
): t.Statement | undefined {
  const declaredLanguage =
    extension === '.mjs'
      ? 'js'
      : extension === '.mts'
        ? 'ts'
        : extension.slice(1);
  const languages = new Set<string>([declaredLanguage]);
  if (declaredLanguage === 'js' || declaredLanguage === 'jsx') {
    languages.add('flow');
  }
  languages.add('tsx');
  for (const language of languages) {
    try {
      const ast = parseScriptAst(source, language);
      if (ast.program.body.length === 1) return ast.program.body[0];
    } catch {
      // Try the next project-compatible grammar for this isolated statement.
    }
  }
  return undefined;
}

/** Adds runtime re-exports without trusting declarations around the syntax error. */
function collectRecoveredExport(
  record: RecoveredModuleRecord,
  statement: t.Statement
): void {
  if (statement.type === 'ExportAllDeclaration') {
    if (statement.exportKind !== 'type') {
      record.starExports.push(statement.source.value);
    }
    return;
  }
  if (
    statement.type !== 'ExportNamedDeclaration' ||
    statement.exportKind === 'type' ||
    !statement.source
  ) {
    return;
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
      addRecoveredExplicitExport(record, exportedName, {
        source: statement.source.value,
        type: 'namespace',
      });
      continue;
    }
    if (specifier.type !== 'ExportSpecifier') continue;
    addRecoveredExplicitExport(record, exportedName, {
      importedName: specifier.local.name,
      source: statement.source.value,
      type: 'reexport',
    });
  }
}

/** Preserves ambiguity instead of selecting an arbitrary recovered identity. */
function addRecoveredExplicitExport(
  record: RecoveredModuleRecord,
  name: string,
  value: RecoveredDeclaredExport
): void {
  record.explicitExports.set(
    name,
    record.explicitExports.has(name) ? 'ambiguous' : value
  );
}

function collectImportedBindings(ast: t.File): Map<string, ImportedBinding> {
  const imports = new Map<string, ImportedBinding>();
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      isTypeOnlyImportKind(statement.importKind)
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        !isTypeOnlyImportKind(specifier.importKind)
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

/** Returns whether Babel classified an ESM binding as type-only. */
function isTypeOnlyImportKind(kind: string | null | undefined): boolean {
  return kind === 'type' || kind === 'typeof';
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
  exportName: string,
  recognizeAllGTRuntimeExports: boolean
): boolean {
  if (source === 'vue') {
    return (VUE_EXPORT_NAMES as readonly string[]).includes(exportName);
  }
  const recognizedNames = recognizeAllGTRuntimeExports
    ? GT_RUNTIME_EXPORT_NAMES
    : GT_EXPORT_NAMES;
  return (recognizedNames as readonly string[]).includes(exportName);
}
