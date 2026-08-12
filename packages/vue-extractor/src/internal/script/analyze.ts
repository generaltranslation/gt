import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse';
import type * as t from '@babel/types';
import { processVueStringCall } from '../stringCalls.js';
import {
  appendTemplatePath,
  unknownTemplatePathSegment,
} from '../templatePath.js';
import type {
  TemplateBindings,
  TemplateContainerKind,
  VueExtractionContext,
} from '../types.js';
import {
  addVueError,
  babelLocation,
  readStaticGlobalPrimitive,
  readStaticPrimitive,
  type StaticPrimitive,
  type StaticPrimitiveResult,
  unwrapExpression,
} from '../utils.js';
import type {
  CollectedObjectEntries,
  ComponentFactoryCandidate,
  ComponentKind,
  ComponentMemberCandidate,
  ContainerWrapperKind,
  ContainerWritePolicy,
  GTContainerExposure,
  KnownValue,
  ObjectEntryResult,
  ScopedExpression,
  ScriptState,
  TemplateExposure,
  TemplateKnownValue,
  VueScriptAnalysis,
  VueScriptAnalysisStats,
} from './model.js';
import { createReplayAnalysis } from './replay.js';
import { createSnapshotAnalysis } from './snapshot.js';
import {
  COMPONENT_IMPORTS,
  knownExport,
  knownValueKey,
  ORDINARY_GLOBAL_VALUES,
  READONLY_ARRAY_TRANSFORMS,
  VUE_BUILTIN_IMPORTS,
} from './knownValues.js';
import {
  extractVueJSXTranslation,
  isNestedInVueJSXTranslation,
  resolveVueJSXElementIdentity,
  validateVueJSXVariableComponent,
  type VueJSXAnalysis,
} from './jsx.js';
import type {
  LocalExportResolution,
  LocalExportTarget,
  LocalModuleRecord,
} from './localModules.js';
import { parseScriptAst } from './parser.js';
import { isKnownNonVueGTRuntime } from './runtimeModules.js';
import {
  isAssignmentTargetWrapper,
  isBindingPattern,
  isStaticallyUndefined,
  patternContains,
  readMemberProperty,
  readPatternIdentifier,
  readPropertyKey,
} from './syntax.js';

export type { VueScriptAnalysis, VueScriptAnalysisStats } from './model.js';

const traverse = traverseModule.default || traverseModule;

const staticBindingResults = new WeakMap<
  VueScriptAnalysis,
  Map<Binding, StaticPrimitiveResult>
>();
const staticBindingsInProgress = new WeakMap<VueScriptAnalysis, Set<Binding>>();

/** Creates opt-in counters for deterministic analyzer complexity tests. */
export function createVueScriptAnalysisStats(): VueScriptAnalysisStats {
  return {
    arrayEntryVisits: 0,
    containerKindVisits: 0,
    finalContainerSnapshotReads: 0,
    knownExpressionVisits: 0,
    stringFunctionVisits: 0,
    transformArrayEntryVisits: 0,
  };
}

/** Creates the per-SFC state used to resolve cross-block imports safely. */
export function createVueScriptAnalysis(
  stats?: VueScriptAnalysisStats
): VueScriptAnalysis {
  return {
    ...(stats && { stats }),
    arrayLengths: new Map(),
    componentFactories: new Set(),
    containerKinds: new Map(),
    directBindings: new Set(),
    gtComponentFactories: new Set(),
    gtContainerFactories: new Set(),
    hasGTSourceReference: false,
    possibleGTContainers: new Set(),
    possibleStaticStrings: new Map(),
    staticValues: new Map(),
    templateValues: new Map(),
    uncertainComponents: new Set(),
    uncertainGTComponents: new Set(),
    uncertainStringFunctions: new Set(),
    uncertainTranslationHelpers: new Set(),
    values: new Map(),
  };
}

/** Exposes imports from a normal script when the SFC also has script setup. */
export function exposeVueScriptImportsToTemplate(
  analysis: VueScriptAnalysis,
  templateBindings: TemplateBindings
): void {
  for (const localName of analysis.directBindings) {
    templateBindings.directBindings.add(localName);
  }
  for (const [localName, value] of analysis.values) {
    templateBindings.directBindings.add(localName);
    exposeKnownValue(localName, value, templateBindings, analysis);
  }
  for (const [localName, value] of analysis.templateValues) {
    templateBindings.directBindings.add(localName);
    exposeKnownValue(localName, value, templateBindings, analysis);
  }
  for (const [localName, value] of analysis.staticValues) {
    templateBindings.directBindings.add(localName);
    templateBindings.staticValues.set(localName, value);
  }
  for (const localName of analysis.componentFactories) {
    templateBindings.componentFactories.add(localName);
  }
  for (const [localName, kind] of analysis.containerKinds) {
    templateBindings.containerKinds.set(localName, kind);
  }
  for (const [localName, length] of analysis.arrayLengths) {
    templateBindings.arrayLengths.set(localName, length);
  }
  for (const [localName, values] of analysis.possibleStaticStrings) {
    templateBindings.possibleStaticStrings.set(localName, new Set(values));
  }
  for (const localName of analysis.possibleGTContainers) {
    templateBindings.possibleGTContainers.add(localName);
  }
  for (const localName of analysis.gtContainerFactories) {
    templateBindings.gtContainerFactories.add(localName);
  }
  for (const localName of analysis.gtComponentFactories) {
    templateBindings.gtComponentFactories.add(localName);
  }
  for (const localName of analysis.uncertainComponents) {
    templateBindings.uncertainComponents.add(localName);
  }
  for (const localName of analysis.uncertainGTComponents) {
    templateBindings.uncertainGTComponents.add(localName);
  }
  for (const localName of analysis.uncertainStringFunctions) {
    templateBindings.uncertainStringFunctions.add(localName);
  }
}

/** Collects imports before either SFC script block is fully analyzed. */
export function collectVueScriptImports(
  source: string,
  language: string | undefined,
  analysis: VueScriptAnalysis
): void {
  if (!source.trim()) return;
  try {
    const ast = parseScriptAst(source, language);
    const state = createScriptState(ast, analysis);
    collectImports(ast, state);
  } catch {
    // The full analysis pass reports the parser diagnostic once.
  }
}

/** Extracts calls and component bindings from one padded Vue script block. */
export function parseVueScript(
  source: string,
  language: string | undefined,
  context: VueExtractionContext,
  templateBindings: TemplateBindings,
  exposeToTemplate: boolean,
  analysis: VueScriptAnalysis = createVueScriptAnalysis(),
  analyzeOptionsApi = true
): boolean {
  if (!source.trim()) return true;
  const initialErrorCount = context.errors.length;

  let ast: t.File;
  try {
    ast = parseScriptAst(source, language);
  } catch (error) {
    const syntaxError = error as SyntaxError & {
      loc?: { column: number; line: number };
    };
    addVueError(
      context,
      syntaxError.loc
        ? {
            start: {
              column: syntaxError.loc.column + 1,
              line: syntaxError.loc.line,
              offset: 0,
            },
            end: {
              column: syntaxError.loc.column + 1,
              line: syntaxError.loc.line,
              offset: 0,
            },
          }
        : undefined,
      `Could not parse a gt-vue script block: ${syntaxError.message}`,
      'Fix the script syntax before extracting translations'
    );
    return false;
  }

  const state = createScriptState(ast, analysis);
  collectImports(ast, state);
  analyzeMutableNamespaceSafety(ast, state);

  const jsxAnalysis: VueJSXAnalysis = {
    customPragma: ast.comments?.find((comment) =>
      /\*?\s*@jsx\s+([^\s]+)/.test(comment.value)
    ),
    readStaticPrimitive: (expression, scope) =>
      readStaticFromScope(
        expression,
        scope,
        new Set(),
        expression.start ?? Number.POSITIVE_INFINITY,
        state.analysis
      ),
    resolveKnownValue: (expression, scope) =>
      resolveKnownExpression(expression, scope, state, new Set()),
    resolveStaticObject: (expression, scope) =>
      resolveObjectExpression(
        expression,
        scope,
        new Set(),
        expression.start ?? Number.POSITIVE_INFINITY
      ),
    scopeForNode: (node, fallback) => state.scopes.get(node) ?? fallback,
  };

  if (exposeToTemplate) {
    recordCrossBlockWrites(ast, state, templateBindings);
    exposeProgramBindings(ast, state, templateBindings);
  } else {
    recordProgramAnalysis(ast, state);
    if (analyzeOptionsApi) {
      exposeOptionsApiBindings(ast, state, templateBindings, context);
    }
  }
  type StringCallPath = {
    node: t.CallExpression | t.OptionalCallExpression;
    scope: Scope;
  };

  const processCallAtLocation = (
    path: StringCallPath,
    consumerLocation = babelLocation(path.node.loc)
  ): void => {
    if (
      state.activeTranslationFunctions.size > 0 &&
      resolveKnownCallTargetWithoutParameterSubstitutions(
        path.node.callee,
        path.scope,
        path.node.start ?? Number.POSITIVE_INFINITY,
        state
      ).value?.type === 'string'
    ) {
      return;
    }
    const vueHelper = readImportedFunctionName(
      path.node.callee,
      path.scope,
      'vue',
      state
    );
    const firstArgument = path.node.arguments[0];
    if (
      vueHelper &&
      ['createVNode', 'h'].includes(vueHelper) &&
      firstArgument &&
      firstArgument.type !== 'ArgumentPlaceholder' &&
      firstArgument.type !== 'SpreadElement' &&
      expressionContainsGTReference(firstArgument, path.scope, state)
    ) {
      state.analysis.hasGTSourceReference = true;
      addVueError(
        context,
        consumerLocation,
        'Found an unsupported gt-vue <T> component in a Vue render function',
        'Move the rich translation into a Vue single-file component template'
      );
    }
    if (
      vueHelper === 'defineAsyncComponent' &&
      firstArgument &&
      firstArgument.type !== 'ArgumentPlaceholder' &&
      firstArgument.type !== 'SpreadElement' &&
      expressionContainsGTReference(firstArgument, path.scope, state)
    ) {
      state.analysis.hasGTSourceReference = true;
      addVueError(
        context,
        consumerLocation,
        'Could not statically extract a gt-vue <T> component behind defineAsyncComponent()',
        'Use a direct gt-vue component binding in the Vue template'
      );
    }
    const callTarget = resolveKnownCallTargetAtPosition(
      path.node.callee,
      path.scope,
      path.node.start ?? Number.POSITIVE_INFINITY,
      state
    );
    const value = callTarget.value;
    if (value?.type !== 'string') {
      const localCallable = resolveCalledFunction(
        path.node.callee,
        path.scope,
        state,
        new Set()
      );
      const calleePath = readResolvedMemberPath(
        path.node.callee,
        path.scope,
        state
      );
      const calleeExpression = unwrapExpression(path.node.callee);
      const calleeSubstitution =
        calleeExpression?.type === 'Identifier'
          ? path.scope.getBinding(calleeExpression.name)
          : undefined;
      const materializedCallee = calleeSubstitution
        ? readParameterSubstitution(calleeSubstitution, state)
        : undefined;
      const possibleStringCallee = expressionMayProduceStringFunction(
        materializedCallee?.node ??
          (calleeExpression?.type !== 'Identifier'
            ? path.node.callee
            : undefined),
        materializedCallee?.scope ?? path.scope,
        state,
        new Set()
      );
      const uncertainTranslationHelper = Boolean(
        calleePath &&
        pathMayReferenceUncertainTranslationHelper(
          path.node.callee,
          calleePath,
          path.scope,
          state
        ) &&
        callArgumentsMayProvideTranslationFunction(path.node, path.scope, state)
      );
      if (
        !callTarget.definitelyOrdinary &&
        !localCallable &&
        (callTarget.possibleStringFunction ||
          possibleStringCallee ||
          uncertainTranslationHelper ||
          (calleePath &&
            (templateBindings.uncertainStringFunctions.has(calleePath) ||
              state.analysis.uncertainStringFunctions.has(calleePath) ||
              (calleePath.endsWith('.value') &&
                templateBindings.uncertainStringFunctions.has(
                  calleePath.slice(0, -'.value'.length)
                )))))
      ) {
        addVueError(
          context,
          consumerLocation,
          `Could not statically resolve possible gt-vue string function alias "${calleePath ?? '<dynamic callee>'}"`,
          'Use a direct, immutable alias of useGT(), useMessages(), msg(), or t()'
        );
      }
      processForwardedTranslationCalls(path, consumerLocation);
      return;
    }
    state.analysis.hasGTSourceReference = true;
    processVueStringCall(
      path.node,
      value.kind,
      consumerLocation,
      context,
      (node) => {
        if (!node) return { ok: false };
        const materialized = materializeParameterExpression(
          node,
          path.scope,
          state
        );
        return readStaticFromScope(
          materialized.node,
          materialized.scope,
          new Set(),
          materialized.node.end ?? Number.POSITIVE_INFINITY,
          state.analysis
        );
      }
    );
    processForwardedTranslationCalls(path, consumerLocation);
  };

  const processForwardedTranslationCalls = (
    path: StringCallPath,
    consumerLocation: ReturnType<typeof babelLocation>
  ): void => {
    const called = resolveCalledFunction(
      path.node.callee,
      path.scope,
      state,
      new Set()
    );
    if (
      !called ||
      state.activeTranslationFunctions.has(called.node) ||
      !callMayCarryTranslationFunction(path.node, path.scope, state)
    )
      return;
    const functionPath = state.paths.get(called.node);
    if (!functionPath) return;
    state.activeTranslationFunctions.add(called.node);
    try {
      withCallParameterSubstitutions(
        path.node,
        called,
        path.scope,
        state,
        () => {
          functionPath.traverse({
            Function(nestedPath) {
              nestedPath.skip();
            },
            CallExpression(callPath) {
              processCallAtLocation(callPath, consumerLocation);
            },
            OptionalCallExpression(callPath) {
              processCallAtLocation(callPath, consumerLocation);
            },
          });
        }
      );
    } finally {
      state.activeTranslationFunctions.delete(called.node);
    }
  };

  const processCall = (path: StringCallPath): void => {
    processCallAtLocation(path);
  };

  traverse(ast, {
    CallExpression: processCall,
    OptionalCallExpression: processCall,
    TaggedTemplateExpression(path) {
      const value = resolveKnownExpression(
        path.node.tag,
        path.scope,
        state,
        new Set()
      );
      if (value?.type !== 'string') return;
      state.analysis.hasGTSourceReference = true;
      addVueError(
        context,
        babelLocation(path.node.loc),
        'Found an unsupported tagged template translation in gt-vue',
        'Call the translation function with a string literal instead'
      );
    },
    JSXElement(path) {
      const value = resolveVueJSXElementIdentity(
        path.node.openingElement.name,
        path.scope,
        jsxAnalysis
      );
      if (value?.type === 'component') {
        state.analysis.hasGTSourceReference = true;
      }
      if (
        value?.type === 'component' &&
        (value.name === 'Var' ||
          value.name === 'Num' ||
          value.name === 'DateTime' ||
          value.name === 'Currency')
      ) {
        validateVueJSXVariableComponent(path.node, value.name, context);
      }
      if (value?.type !== 'component' || value.name !== 'T') return;
      if (isNestedInVueJSXTranslation(path, jsxAnalysis)) return;
      extractVueJSXTranslation(path, context, jsxAnalysis);
    },
  });
  if (
    state.unsupportedDynamicGTReference &&
    context.errors.length === initialErrorCount
  ) {
    addVueError(
      context,
      undefined,
      'Could not statically resolve possible gt-vue string function alias from a dynamic import',
      'Use a static gt-vue import so translation ownership can be extracted deterministically'
    );
  }
  if (
    state.unsupportedMalformedGTReference &&
    context.errors.length === initialErrorCount
  ) {
    addVueError(
      context,
      undefined,
      'Could not statically resolve a gt-vue reference imported through a malformed local module',
      'Fix the local module syntax so translation ownership can be extracted deterministically'
    );
  }
  return true;
}

/** Indexes Babel's lexical scopes so deferred function analysis stays exact. */
function createScriptState(
  ast: t.File,
  analysis: VueScriptAnalysis
): ScriptState {
  const state: ScriptState = {
    activeComponentFunctions: new Set(),
    activeReplayFunctions: new Set(),
    activeStringFunctions: new Set(),
    activeTranslationFunctions: new Set(),
    analysis,
    attachedLocalModules: new Set(),
    arrayEntries: new Map(),
    arrayEntriesInProgress: new Set(),
    componentPossibilities: new Map(),
    componentFactoryCandidates: new Map(),
    componentFactoryCandidatesInProgress: new Set(),
    bindings: new Map(),
    containerKindSnapshots: new Map(),
    containerKindSnapshotsInProgress: new Set(),
    containerIdentityReplays: new WeakMap(),
    containerWritePolicies: new Map(),
    definiteNonStringFunctionBindings: new Set(),
    definiteNonStringFunctionBindingsInProgress: new Set(),
    entryProgram: ast.program,
    finalContainerSnapshots: new Map(),
    finalContainerSnapshotsInProgress: new Set(),
    gtContainerPossibilities: new Map(),
    gtContainerPossibilitiesInProgress: new Set(),
    gtContainerPaths: new Map(),
    gtContainerPathsInProgress: new Set(),
    localCallableBindings: new Map(),
    mutationGTContainerPaths: new Map(),
    mutationGTContainerPathsInProgress: new Set(),
    mutationPossibleStaticStrings: new Map(),
    mutationPossibleStaticStringsInProgress: new Set(),
    mutableImportSources: new Map(),
    nextReplayIdentityKey: 0,
    parameterSubstitutions: [],
    paths: new WeakMap(),
    possibleStaticStrings: new Map(),
    possibleStaticStringsInProgress: new Set(),
    possibleStaticStringMembers: new Map(),
    possibleStaticStringMembersInProgress: new Set(),
    readonlyContainerUses: new Map(),
    readonlyContainerUsesInProgress: new Set(),
    replayIdentityKeys: new WeakMap(),
    resolvedBindings: new Set(),
    scopes: new WeakMap(),
    thisSubstitutions: [],
    transformArrayEntries: new Map(),
    transformArrayEntriesInProgress: new Set(),
    uncertainTranslationHelperBindings: new Set(),
    unsupportedDynamicGTReference: false,
    unsupportedMalformedGTReference: false,
    unsafeMutableNamespaceSources: new Set(),
  };
  traverse(ast, {
    enter(path) {
      state.paths.set(path.node, path as NodePath<t.Node>);
      state.scopes.set(path.node, path.scope);
    },
  });
  return state;
}

/** Marks a CommonJS module unsafe when any retained alias mutates or escapes it. */
function analyzeMutableNamespaceSafety(ast: t.File, state: ScriptState): void {
  for (const [binding, value] of state.bindings) {
    if (
      value.type === 'namespace' &&
      value.mutable &&
      !isSafeMutableNamespaceBinding(binding)
    ) {
      state.unsafeMutableNamespaceSources.add(value.source);
    }
  }
  traverse(ast, {
    CallExpression(path) {
      const namespace = readRequireNamespace(path.node, path.scope);
      if (namespace && directRequireCanMutate(path)) {
        state.unsafeMutableNamespaceSources.add(namespace.source);
      }
    },
    OptionalCallExpression(path) {
      const namespace = readRequireNamespace(path.node, path.scope);
      if (namespace && directRequireCanMutate(path)) {
        state.unsafeMutableNamespaceSources.add(namespace.source);
      }
    },
  });
}

/** Distinguishes a fresh export read from mutation of the require result. */
function directRequireCanMutate(
  path: NodePath<t.CallExpression | t.OptionalCallExpression>
): boolean {
  const parent = path.parentPath;
  if (!parent) return true;
  if (parent.isVariableDeclarator() && parent.node.init === path.node) {
    return false;
  }
  if (
    (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
    parent.node.object === path.node
  ) {
    return memberChainWrites(parent);
  }
  return true;
}

/** Allows export reads while rejecting writes or escape of the namespace object. */
function isSafeMutableNamespaceBinding(binding: Binding): boolean {
  return (
    binding.constant &&
    binding.referencePaths.every((reference) => {
      const parent = reference.parentPath;
      return Boolean(
        parent &&
        (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
        parent.node.object === reference.node &&
        !memberChainWrites(parent)
      );
    })
  );
}

/** Detects writes through a member chain rooted in a namespace object. */
function memberChainWrites(
  memberPath: NodePath<t.MemberExpression | t.OptionalMemberExpression>
): boolean {
  let current: NodePath<t.Node> = memberPath;
  while (
    current.parentPath &&
    (current.parentPath.isMemberExpression() ||
      current.parentPath.isOptionalMemberExpression()) &&
    current.parentPath.node.object === current.node
  ) {
    current = current.parentPath;
  }
  const parent = current.parentPath;
  return Boolean(
    parent &&
    ((parent.isAssignmentExpression() && parent.node.left === current.node) ||
      (parent.isUpdateExpression() && parent.node.argument === current.node) ||
      (parent.isUnaryExpression({ operator: 'delete' }) &&
        parent.node.argument === current.node) ||
      ((parent.isForInStatement() || parent.isForOfStatement()) &&
        parent.node.left === current.node))
  );
}

function collectImports(
  ast: t.File,
  state: ScriptState,
  importerFile = state.analysis.entryFile
): void {
  traverse(ast, {
    enter(path) {
      if (
        importerFile === state.analysis.entryFile &&
        (path.isCallExpression() || path.node.type === 'ImportExpression') &&
        readDynamicImport(path.node)?.source === 'gt-vue'
      ) {
        state.analysis.hasGTSourceReference = true;
        state.unsupportedDynamicGTReference = true;
      }
    },
    ImportDeclaration(path) {
      if (isTypeOnlyImportKind(path.node.importKind)) return;
      const source = path.node.source.value;
      if (
        source === 'gt-vue' &&
        hasRuntimeImport(path.node) &&
        importerFile === state.analysis.entryFile
      ) {
        state.analysis.hasGTSourceReference = true;
      }
      if (source !== 'gt-vue' && source !== 'vue') {
        registerLocalImportDeclaration(
          path.node,
          path.scope,
          importerFile,
          state
        );
        return;
      }

      for (const specifierPath of path.get('specifiers')) {
        const specifier = specifierPath.node;
        if (specifier.type === 'ImportNamespaceSpecifier') {
          registerImport(
            specifier.local.name,
            { type: 'namespace', source, mutable: false },
            specifierPath.scope,
            state
          );
          continue;
        }
        if (
          specifier.type !== 'ImportSpecifier' ||
          isTypeOnlyImportKind(specifier.importKind)
        ) {
          continue;
        }
        const importedName =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        const value = knownExport(source, importedName);
        if (value) {
          registerImport(
            specifier.local.name,
            value,
            specifierPath.scope,
            state
          );
        }
      }
    },
    ExportNamedDeclaration(path) {
      if (
        path.node.exportKind === 'type' ||
        !path.node.source ||
        importerFile !== state.analysis.entryFile
      ) {
        return;
      }
      const exportNames = path.node.specifiers.flatMap((specifier) => {
        if (
          specifier.type === 'ExportSpecifier' &&
          isTypeOnlyImportKind(specifier.exportKind)
        ) {
          return [];
        }
        if (specifier.type === 'ExportNamespaceSpecifier') return ['*'];
        if (specifier.type !== 'ExportSpecifier') return [];
        return [specifier.local.name];
      });
      recordRuntimeReexport(
        path.node.source.value,
        exportNames,
        importerFile,
        state
      );
    },
    ExportAllDeclaration(path) {
      if (
        path.node.exportKind === 'type' ||
        importerFile !== state.analysis.entryFile
      ) {
        return;
      }
      recordRuntimeReexport(path.node.source.value, ['*'], importerFile, state);
    },
    TSImportEqualsDeclaration(path) {
      if (path.node.importKind === 'type') return;
      const reference = path.node.moduleReference;
      if (
        reference.type !== 'TSExternalModuleReference' ||
        reference.expression.type !== 'StringLiteral'
      ) {
        return;
      }
      const source = reference.expression.value;
      if (source !== 'gt-vue' && source !== 'vue') return;
      if (source === 'gt-vue' && importerFile === state.analysis.entryFile) {
        state.analysis.hasGTSourceReference = true;
      }
      registerImport(
        path.node.id.name,
        { type: 'namespace', source, mutable: true },
        path.scope,
        state
      );
    },
    VariableDeclarator(path) {
      const dynamicImport = readDynamicImport(path.node.init);
      if (dynamicImport) {
        recordDynamicImportPattern(
          path.node.id,
          dynamicImport.source,
          path.scope,
          importerFile,
          state
        );
        return;
      }
      const namespace = readRequireNamespace(path.node.init, path.scope);
      if (!namespace) return;
      if (
        namespace.source === 'gt-vue' &&
        importerFile === state.analysis.entryFile
      ) {
        state.analysis.hasGTSourceReference = true;
      }
      registerRequirePattern(path.node.id, namespace, path.scope, state);
    },
  });
  propagateUncertainTranslationHelperAliases(ast, state);
}

/** Marks only runtime re-exports statically connected to gt-vue. */
function recordRuntimeReexport(
  source: string,
  exportNames: string[],
  importerFile: string | undefined,
  state: ScriptState
): void {
  if (!importerFile || exportNames.length === 0) return;
  if (source === 'gt-vue') {
    state.analysis.hasGTSourceReference = true;
    return;
  }
  if (source === 'vue' || isKnownNonVueGTRuntime(source)) return;
  const resolver = state.analysis.localModules;
  const modulePath = resolver?.resolveModule(importerFile, source);
  if (!resolver || !modulePath || !resolver.isProjectModule(modulePath)) {
    return;
  }
  const candidateNames = exportNames.includes('*')
    ? [...COMPONENT_IMPORTS, 'msg', 't', 'useGT', 'useMessages']
    : exportNames;
  if (
    candidateNames.some((name) =>
      resolver.hasGTExportReference(modulePath, name)
    )
  ) {
    state.analysis.hasGTSourceReference = true;
  }
}

/** Returns whether an import causes a runtime module reference. */
function hasRuntimeImport(declaration: t.ImportDeclaration): boolean {
  return (
    declaration.specifiers.length === 0 ||
    declaration.specifiers.some(
      (specifier) =>
        specifier.type !== 'ImportSpecifier' ||
        !isTypeOnlyImportKind(specifier.importKind)
    )
  );
}

/** Returns whether Babel classified an ESM binding as type-only. */
function isTypeOnlyImportKind(kind: string | null | undefined): boolean {
  return kind === 'type' || kind === 'typeof';
}

/** Retains unresolved-helper provenance through simple immutable aliases. */
function propagateUncertainTranslationHelperAliases(
  ast: t.File,
  state: ScriptState
): void {
  const candidates: Array<{
    binding: Binding;
    source: t.Node;
    sourcePath: string;
    sourceScope: Scope;
    targetName: string;
  }> = [];
  traverse(ast, {
    VariableDeclarator(path) {
      if (!path.node.init) return;
      const sourcePath = readResolvedMemberPath(
        path.node.init,
        path.scope,
        state
      );
      if (!sourcePath) return;
      for (const targetName of collectPatternBindingNames(path.node.id)) {
        const binding = path.scope.getBinding(targetName);
        if (binding?.constant) {
          candidates.push({
            binding,
            source: path.node.init,
            sourcePath,
            sourceScope: path.scope,
            targetName,
          });
        }
      }
    },
  });

  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      if (
        state.uncertainTranslationHelperBindings.has(candidate.binding) ||
        !pathMayReferenceUncertainTranslationHelper(
          candidate.source,
          candidate.sourcePath,
          candidate.sourceScope,
          state
        )
      ) {
        continue;
      }
      state.analysis.uncertainTranslationHelpers.add(candidate.targetName);
      state.uncertainTranslationHelperBindings.add(candidate.binding);
      changed = true;
    }
  }
}

/** Reads an import() source, including a single surrounding await. */
function readDynamicImport(
  node: t.Node | null | undefined
): { source?: string } | undefined {
  let expression = unwrapExpression(node);
  if (expression?.type === 'AwaitExpression') {
    expression = unwrapExpression(expression.argument);
  }
  if (!expression) return undefined;
  if (expression.type === 'ImportExpression') {
    const source = unwrapExpression(expression.source);
    return {
      source: source?.type === 'StringLiteral' ? source.value : undefined,
    };
  }
  if (
    expression.type !== 'CallExpression' ||
    expression.callee.type !== 'Import'
  ) {
    return undefined;
  }
  const source = unwrapExpression(expression.arguments[0]);
  return {
    source: source?.type === 'StringLiteral' ? source.value : undefined,
  };
}

/** Marks GT-shaped values selected from a dynamic namespace as unresolved. */
function recordDynamicImportPattern(
  pattern: t.LVal | t.VoidPattern,
  source: string | undefined,
  scope: Scope,
  importerFile: string | undefined,
  state: ScriptState
): void {
  if (pattern.type === 'VoidPattern') return;
  if (source && isKnownNonVueGTRuntime(source)) return;
  if (source === 'gt-vue' && importerFile === state.analysis.entryFile) {
    state.analysis.hasGTSourceReference = true;
    state.unsupportedDynamicGTReference = true;
  }
  const resolver = state.analysis.localModules;
  const modulePath =
    source && source !== 'gt-vue' && source !== 'vue' && importerFile
      ? resolver?.resolveModule(importerFile, source)
      : undefined;
  if (source === 'vue') return;
  if (source && source !== 'gt-vue' && !modulePath) return;
  if (modulePath && resolver && !resolver.isProjectModule(modulePath)) {
    return;
  }
  if (pattern.type === 'Identifier') {
    if (modulePath && resolver) {
      const binding = scope.getBinding(pattern.name);
      for (const exportName of [
        ...COMPONENT_IMPORTS,
        'msg',
        't',
        'useGT',
        'useMessages',
      ]) {
        recordDynamicImportBinding(
          appendTemplatePath(pattern.name, exportName),
          exportName,
          modulePath,
          state,
          bindingReferencesNamespaceMember(binding, exportName, state)
        );
      }
    } else {
      for (const component of COMPONENT_IMPORTS) {
        const path = appendTemplatePath(pattern.name, component);
        state.analysis.uncertainComponents.add(path);
        state.analysis.uncertainGTComponents.add(path);
      }
      for (const name of ['msg', 't', 'useGT', 'useMessages']) {
        state.analysis.uncertainStringFunctions.add(
          appendTemplatePath(pattern.name, name)
        );
      }
    }
    return;
  }
  if (pattern.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty') continue;
    const exportedName = readPropertyKey(property);
    const localName = readPatternIdentifier(property.value);
    if (exportedName && localName) {
      if (modulePath) {
        recordDynamicImportBinding(
          localName,
          exportedName,
          modulePath,
          state,
          importerFile === state.analysis.entryFile
        );
      } else {
        recordUnresolvedGTShapedBinding(localName, exportedName, state);
      }
    }
  }
  // Resolve computed destructuring only when its key is static. Dynamic keys
  // and object-rest aliases intentionally remain unusable for GT extraction.
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty' || !property.computed) continue;
    const exportedName = readResolvedPropertyKey(property, scope, state);
    const localName = readPatternIdentifier(property.value);
    if (exportedName && localName) {
      if (modulePath) {
        recordDynamicImportBinding(
          localName,
          exportedName,
          modulePath,
          state,
          importerFile === state.analysis.entryFile
        );
      } else {
        recordUnresolvedGTShapedBinding(localName, exportedName, state);
      }
    }
  }
}

/** Returns whether one namespace binding is used through a static member. */
function bindingReferencesNamespaceMember(
  binding: Binding | undefined,
  memberName: string,
  state: ScriptState,
  seen: Set<Binding> = new Set()
): boolean {
  if (!binding || seen.has(binding)) return false;
  const nextSeen = new Set(seen).add(binding);
  return Boolean(
    binding.referencePaths.some((referencePath) => {
      let reference: NodePath<t.Node> = referencePath;
      while (
        reference.parentPath &&
        unwrapExpression(reference.parentPath.node) === reference.node
      ) {
        reference = reference.parentPath;
      }
      const parent = reference.parentPath;
      if (
        parent?.isMemberExpression() ||
        parent?.isOptionalMemberExpression()
      ) {
        return (
          parent.node.object === reference.node &&
          readResolvedMemberProperty(parent.node, parent.scope, state) ===
            memberName
        );
      }
      if (parent?.isJSXMemberExpression()) {
        return (
          parent.node.object === reference.node &&
          parent.node.property.name === memberName
        );
      }
      if (
        parent?.isVariableDeclarator() &&
        parent.node.init === reference.node
      ) {
        if (parent.node.id.type === 'Identifier') {
          return bindingReferencesNamespaceMember(
            parent.scope.getBinding(parent.node.id.name),
            memberName,
            state,
            nextSeen
          );
        }
        if (parent.node.id.type === 'ObjectPattern') {
          return parent.node.id.properties.some(
            (property) =>
              property.type === 'RestElement' ||
              (property.type === 'ObjectProperty' &&
                readResolvedPropertyKey(property, parent.scope, state) ===
                  memberName)
          );
        }
      }
      if (
        parent?.isCallExpression() ||
        parent?.isNewExpression() ||
        parent?.isReturnStatement() ||
        parent?.isSpreadElement() ||
        parent?.isArrayExpression() ||
        parent?.isObjectProperty()
      ) {
        return true;
      }
      return false;
    })
  );
}

/** Marks only GT roles proven reachable from one static dynamic import. */
function recordDynamicImportBinding(
  localName: string,
  exportName: string,
  modulePath: string,
  state: ScriptState,
  establishesEntryProvenance: boolean
): void {
  const resolution = state.analysis.localModules?.resolveExport(
    modulePath,
    exportName
  );
  if (!resolution || resolution.status === 'absent') return;
  if (resolution.status !== 'resolved') {
    if (
      resolution.status === 'invalid' &&
      materializeRecoveredOrdinaryResolution(resolution, state) !== undefined
    ) {
      return;
    }
    if (
      establishesEntryProvenance &&
      resolution.status === 'invalid' &&
      resolution.hasGTSourceReference
    ) {
      state.analysis.hasGTSourceReference = true;
      state.unsupportedDynamicGTReference = true;
      state.unsupportedMalformedGTReference = true;
    }
    if (resolution.status === 'invalid' && resolution.hasGTSourceReference) {
      recordInvalidGTResolution(localName, resolution, state);
    } else {
      recordUnresolvedGTShapedBinding(localName, exportName, state);
    }
    return;
  }
  const materialized = materializeLocalExport(resolution.target, state);
  if (establishesEntryProvenance && materialized.hasGTSourceReference) {
    state.analysis.hasGTSourceReference = true;
    state.unsupportedDynamicGTReference = true;
  }
  recordMaterializedLocalUncertainty(localName, materialized, state, true);
}

/** Resolves one ESM import through a local, read-only source module graph. */
function registerLocalImportDeclaration(
  declaration: t.ImportDeclaration,
  scope: Scope,
  importerFile: string | undefined,
  state: ScriptState
): void {
  const resolver = state.analysis.localModules;
  const source = declaration.source.value;
  if (isKnownNonVueGTRuntime(source)) return;
  const modulePath =
    resolver && importerFile
      ? resolver.resolveModule(importerFile, source)
      : undefined;
  if (modulePath && resolver && !resolver.isProjectModule(modulePath)) return;
  if (!resolver || !modulePath) {
    recordUnresolvedTranslationHelperImports(declaration, scope, state);
    if (
      source.startsWith('.') ||
      source.startsWith('/') ||
      resolver?.hasCustomResolver
    ) {
      recordUnresolvedGTShapedImports(declaration, state);
    }
    return;
  }

  for (const specifier of declaration.specifiers) {
    if (
      specifier.type === 'ImportSpecifier' &&
      isTypeOnlyImportKind(specifier.importKind)
    ) {
      continue;
    }
    if (specifier.type === 'ImportNamespaceSpecifier') {
      const value: KnownValue = { type: 'local-namespace', modulePath };
      registerImport(specifier.local.name, value, scope, state);
      if (importerFile === state.analysis.entryFile) {
        recordLocalNamespaceMembers(
          specifier.local.name,
          modulePath,
          state,
          scope.getBinding(specifier.local.name)
        );
      }
      continue;
    }
    const exportName =
      specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
    const resolution = resolver.resolveExport(modulePath, exportName);
    let materialized: MaterializedLocalExport | undefined;
    if (resolution.status !== 'resolved') {
      if (resolution.status === 'invalid') {
        materialized = materializeRecoveredOrdinaryResolution(
          resolution,
          state,
          true
        );
      }
      if (!materialized) {
        if (
          importerFile === state.analysis.entryFile &&
          resolution.status === 'invalid' &&
          resolution.hasGTSourceReference
        ) {
          state.analysis.hasGTSourceReference = true;
          state.unsupportedMalformedGTReference = true;
        }
        recordUncertainTranslationHelperBinding(
          specifier.local.name,
          scope,
          state
        );
        if (resolution.status === 'ambiguous') {
          recordAmbiguousLocalBinding(specifier.local.name, state);
        } else if (
          resolution.status === 'invalid' &&
          resolution.hasGTSourceReference
        ) {
          recordInvalidGTResolution(specifier.local.name, resolution, state);
        } else {
          recordUnresolvedGTShapedBinding(
            specifier.local.name,
            exportName,
            state
          );
        }
        continue;
      }
    } else {
      materialized = materializeLocalExport(resolution.target, state);
    }
    if (
      importerFile === state.analysis.entryFile &&
      materialized.hasGTSourceReference
    ) {
      state.analysis.hasGTSourceReference = true;
    }
    const binding = scope.getBinding(specifier.local.name);
    if (materialized.value) {
      registerImport(specifier.local.name, materialized.value, scope, state);
      if (
        materialized.value.type === 'local-namespace' &&
        importerFile === state.analysis.entryFile
      ) {
        recordLocalNamespaceMembers(
          specifier.local.name,
          materialized.value.modulePath,
          state,
          binding
        );
      }
    }
    if (binding && materialized.callable) {
      state.localCallableBindings.set(binding, materialized.callable);
    }
    recordMaterializedLocalUncertainty(
      specifier.local.name,
      materialized,
      state
    );
    if (binding && materialized.unsafeCallable) {
      state.uncertainTranslationHelperBindings.add(binding);
    }
  }
}

/** Indexes an imported module's scopes and its own static imports once. */
function attachLocalModule(
  record: LocalModuleRecord,
  state: ScriptState
): void {
  if (state.attachedLocalModules.has(record.filePath)) return;
  state.attachedLocalModules.add(record.filePath);
  traverse(record.ast, {
    enter(path) {
      state.paths.set(path.node, path as NodePath<t.Node>);
      state.scopes.set(path.node, path.scope);
    },
  });
  collectImports(record.ast, state, record.filePath);
}

/** Converts a graph export into an analyzer identity or callable. */
type MaterializedLocalExport = {
  callable?: ScopedExpression & { node: t.Function };
  hasGTSourceReference?: boolean;
  possibleGTComponent?: boolean;
  possibleStringFunction?: boolean;
  unsafeCallable?: boolean;
  value?: KnownValue;
};

function materializeLocalExport(
  target: LocalExportTarget,
  state: ScriptState
): MaterializedLocalExport {
  if (target.type === 'ordinary-external') return {};
  if (target.type === 'external') {
    return {
      hasGTSourceReference: target.source === 'gt-vue',
      value: knownExport(target.source, target.exportName),
    };
  }
  if (target.type === 'external-namespace') {
    return {
      hasGTSourceReference: target.source === 'gt-vue',
      value: { mutable: false, source: target.source, type: 'namespace' },
    };
  }
  if (target.type === 'namespace') {
    return {
      value: { type: 'local-namespace', modulePath: target.modulePath },
    };
  }
  attachLocalModule(target.record, state);
  if (target.type === 'expression') {
    const materialized: MaterializedLocalExport = {
      callable: resolveCalledFunction(
        target.node,
        target.record.programScope,
        state,
        new Set()
      ),
      value: resolveKnownExpression(
        target.node,
        target.record.programScope,
        state,
        new Set()
      ),
      possibleGTComponent: expressionMayProduceComponent(
        target.node,
        target.record.programScope,
        state,
        new Set(),
        'translation'
      ),
      possibleStringFunction: expressionMayProduceStringFunction(
        target.node,
        target.record.programScope,
        state,
        new Set()
      ),
    };
    materialized.hasGTSourceReference = isKnownGTValue(materialized.value);
    return materialized;
  }
  const binding = target.record.programScope.getBinding(target.exportName);
  if (!binding) return {};
  const possibleGTComponent = expressionMayProduceComponent(
    binding.identifier,
    target.record.programScope,
    state,
    new Set(),
    'translation'
  );
  const possibleStringFunction = expressionMayProduceStringFunction(
    binding.identifier,
    target.record.programScope,
    state,
    new Set()
  );
  if (!binding.constant) {
    return {
      possibleGTComponent,
      possibleStringFunction,
      unsafeCallable: bindingMayReferenceLocalCallable(binding, state),
    };
  }
  const materialized: MaterializedLocalExport = {
    callable: resolveCalledFunction(
      binding.identifier,
      target.record.programScope,
      state,
      new Set()
    ),
    possibleGTComponent,
    possibleStringFunction,
    value: resolveKnownBinding(binding, state, new Set()),
  };
  materialized.hasGTSourceReference = isKnownGTValue(materialized.value);
  return materialized;
}

/** Returns whether an exact analyzer identity came from gt-vue. */
function isKnownGTValue(value: KnownValue | undefined): boolean {
  return (
    value?.type === 'component' ||
    value?.type === 'hook' ||
    value?.type === 'string' ||
    (value?.type === 'namespace' && value.source === 'gt-vue')
  );
}

/** Materializes the one ordinary origin proven through a malformed module. */
function materializeRecoveredOrdinaryResolution(
  resolution: Extract<LocalExportResolution, { status: 'invalid' }>,
  state: ScriptState,
  preserveLocalIdentity = false
): MaterializedLocalExport | undefined {
  if (
    resolution.hasGTSourceReference ||
    resolution.gtExportName ||
    resolution.recoveredTargets?.length !== 1
  ) {
    return undefined;
  }
  const target = resolution.recoveredTargets[0];
  if (target.type === 'ordinary-external') return {};
  if (target.type === 'external' || target.type === 'external-namespace') {
    return target.source === 'vue'
      ? materializeLocalExport(target, state)
      : undefined;
  }
  // A recovered local namespace can hide renamed GT exports. The resolver
  // cannot enumerate that shape exhaustively after syntax recovery, so keep
  // the whole namespace fail-closed rather than proving selected names only.
  if (target.type === 'namespace') return undefined;

  const materialized = materializeLocalExport(target, state);
  if (
    materialized.hasGTSourceReference ||
    materialized.possibleGTComponent ||
    materialized.possibleStringFunction ||
    materialized.unsafeCallable ||
    isKnownGTValue(materialized.value)
  ) {
    return undefined;
  }
  if (localTargetAliasesKnownNonVueRuntime(target)) return materialized;
  return preserveLocalIdentity &&
    materialized.callable &&
    isOrdinaryIdentityFunction(materialized.callable.node)
    ? materialized
    : undefined;
}

/** Proves a direct immutable alias back to an official non-Vue GT runtime. */
function localTargetAliasesKnownNonVueRuntime(
  target: Extract<LocalExportTarget, { type: 'expression' | 'local' }>
): boolean {
  if (target.type === 'expression') {
    return expressionAliasesKnownNonVueRuntime(
      target.node,
      target.record.programScope,
      new Set()
    );
  }
  const binding = target.record.programScope.getBinding(target.exportName);
  if (!binding) return false;
  const source = getBindingSource(binding);
  if (!source || source.pattern.type !== 'Identifier') return false;
  return expressionAliasesKnownNonVueRuntime(
    source.expression.node,
    source.expression.scope,
    new Set([binding])
  );
}

/** Follows only immutable identifier aliases to named or default imports. */
function expressionAliasesKnownNonVueRuntime(
  node: t.Node,
  scope: Scope,
  seen: Set<Binding>
): boolean {
  const expression = unwrapExpression(node);
  if (expression?.type !== 'Identifier') return false;
  const binding = scope.getBinding(expression.name);
  if (!binding || seen.has(binding)) return false;
  const declaration = binding.path.parentPath;
  if (
    declaration?.isImportDeclaration() &&
    isKnownNonVueGTRuntime(declaration.node.source.value)
  ) {
    return true;
  }
  const source = getBindingSource(binding);
  return Boolean(
    source &&
    source.pattern.type === 'Identifier' &&
    expressionAliasesKnownNonVueRuntime(
      source.expression.node,
      source.expression.scope,
      new Set(seen).add(binding)
    )
  );
}

/** Proves the narrow local helper form without following unknown dependencies. */
function isOrdinaryIdentityFunction(node: t.Function): boolean {
  if (
    node.async ||
    node.generator ||
    node.params.length !== 1 ||
    node.params[0]?.type !== 'Identifier'
  ) {
    return false;
  }
  const returned =
    node.body.type === 'BlockStatement'
      ? node.body.body.length === 1 &&
        node.body.body[0]?.type === 'ReturnStatement'
        ? node.body.body[0].argument
        : undefined
      : node.body;
  const expression = unwrapExpression(returned);
  return (
    expression?.type === 'Identifier' && expression.name === node.params[0].name
  );
}

/** Makes statically known members of a local namespace visible to templates. */
function recordLocalNamespaceMembers(
  localName: string,
  modulePath: string,
  state: ScriptState,
  binding?: Binding
): void {
  const resolver = state.analysis.localModules;
  if (!resolver) return;
  const exportNames = new Set<string>([
    ...resolver.listExportNames(modulePath),
    ...COMPONENT_IMPORTS,
    'msg',
    't',
    'useGT',
    'useMessages',
  ]);
  for (const exportName of exportNames) {
    const memberPath = appendTemplatePath(localName, exportName);
    const resolution = resolver.resolveExport(modulePath, exportName);
    if (resolution.status === 'absent') continue;
    if (resolution.status !== 'resolved') {
      if (
        resolution.status === 'invalid' &&
        materializeRecoveredOrdinaryResolution(resolution, state) !== undefined
      ) {
        continue;
      }
      if (
        resolution.status === 'invalid' &&
        resolution.hasGTSourceReference &&
        bindingReferencesNamespaceMember(binding, exportName, state)
      ) {
        state.analysis.hasGTSourceReference = true;
        state.unsupportedMalformedGTReference = true;
      }
      state.analysis.uncertainTranslationHelpers.add(memberPath);
      if (resolution.status === 'ambiguous') {
        recordAmbiguousLocalBinding(memberPath, state);
      } else if (
        resolution.status === 'invalid' &&
        resolution.hasGTSourceReference
      ) {
        recordInvalidGTResolution(memberPath, resolution, state);
      } else {
        recordUnresolvedGTShapedBinding(memberPath, exportName, state);
      }
      continue;
    }
    const materialized = materializeLocalExport(resolution.target, state);
    if (materialized.value) {
      state.analysis.values.set(memberPath, materialized.value);
    }
    recordMaterializedLocalUncertainty(memberPath, materialized, state);
  }
}

/** Retains the original gt-vue role hidden by a malformed re-export alias. */
function recordInvalidGTResolution(
  localName: string,
  resolution: Extract<LocalExportResolution, { status: 'invalid' }>,
  state: ScriptState
): void {
  if (resolution.gtExportName === '*') {
    recordUnresolvedGTNamespace(localName, state);
    return;
  }
  if (resolution.gtExportName) {
    recordUnresolvedGTShapedBinding(localName, resolution.gtExportName, state);
    return;
  }
  state.analysis.uncertainTranslationHelpers.add(localName);
}

/** Marks the GT-shaped members of one unresolved namespace path. */
function recordUnresolvedGTNamespace(
  localName: string,
  state: ScriptState
): void {
  for (const component of COMPONENT_IMPORTS) {
    const componentPath = appendTemplatePath(localName, component);
    state.analysis.uncertainComponents.add(componentPath);
    state.analysis.uncertainGTComponents.add(componentPath);
  }
  for (const name of ['msg', 't', 'useGT', 'useMessages']) {
    state.analysis.uncertainStringFunctions.add(
      appendTemplatePath(localName, name)
    );
  }
}

/** Records unresolved roles only when a local export can actually be GT. */
function recordMaterializedLocalUncertainty(
  localName: string,
  materialized: ReturnType<typeof materializeLocalExport>,
  state: ScriptState,
  forceKnownValues = false
): void {
  if (
    materialized.possibleGTComponent ||
    (forceKnownValues && materialized.value?.type === 'component')
  ) {
    state.analysis.uncertainComponents.add(localName);
    state.analysis.uncertainGTComponents.add(localName);
  }
  if (
    materialized.possibleStringFunction ||
    (forceKnownValues && materialized.value?.type === 'string')
  ) {
    state.analysis.uncertainStringFunctions.add(localName);
  }
  if (materialized.unsafeCallable) {
    state.analysis.uncertainTranslationHelpers.add(localName);
  }
}

/** Detects a mutable export that may still be invoked as a local helper. */
function bindingMayReferenceLocalCallable(
  binding: Binding,
  state: ScriptState
): boolean {
  const declaration = binding.path.node;
  if (
    declaration.type === 'VariableDeclarator' &&
    declaration.init &&
    resolveCalledFunction(
      declaration.init,
      binding.path.scope,
      state,
      new Set()
    )
  ) {
    return true;
  }
  return binding.constantViolations.some(
    (violation) =>
      violation.isAssignmentExpression() &&
      patternContains(violation.node.left, binding.identifier.name) &&
      resolveCalledFunction(
        violation.node.right,
        violation.scope,
        state,
        new Set()
      ) !== undefined
  );
}

/** Marks only GT-shaped imports when a custom or bare module is unresolved. */
function recordUnresolvedGTShapedImports(
  declaration: t.ImportDeclaration,
  state: ScriptState
): void {
  for (const specifier of declaration.specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      recordUnresolvedGTNamespace(specifier.local.name, state);
      continue;
    }
    if (
      specifier.type === 'ImportSpecifier' &&
      isTypeOnlyImportKind(specifier.importKind)
    ) {
      continue;
    }
    const importedName =
      specifier.type === 'ImportDefaultSpecifier'
        ? specifier.local.name
        : specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
    recordUnresolvedGTShapedBinding(specifier.local.name, importedName, state);
  }
}

/** Marks unresolved imports only when a call later passes a translator. */
function recordUnresolvedTranslationHelperImports(
  declaration: t.ImportDeclaration,
  scope: Scope,
  state: ScriptState
): void {
  for (const specifier of declaration.specifiers) {
    if (
      specifier.type === 'ImportSpecifier' &&
      isTypeOnlyImportKind(specifier.importKind)
    ) {
      continue;
    }
    recordUncertainTranslationHelperBinding(specifier.local.name, scope, state);
  }
}

/** Records one unresolved helper name together with its lexical binding. */
function recordUncertainTranslationHelperBinding(
  localName: string,
  scope: Scope,
  state: ScriptState
): void {
  state.analysis.uncertainTranslationHelpers.add(localName);
  const binding = scope.getBinding(localName);
  if (binding) state.uncertainTranslationHelperBindings.add(binding);
}

/** Records the conservative GT roles implied by an unresolved export name. */
function recordUnresolvedGTShapedBinding(
  localName: string,
  exportName: string,
  state: ScriptState
): void {
  if (COMPONENT_IMPORTS.has(exportName as never)) {
    state.analysis.uncertainComponents.add(localName);
    state.analysis.uncertainGTComponents.add(localName);
  }
  if (
    exportName === 'msg' ||
    exportName === 't' ||
    exportName === 'useGT' ||
    exportName === 'useMessages'
  ) {
    state.analysis.uncertainStringFunctions.add(localName);
  }
}

/** Fails closed when a resolved local export is ambiguous or mutable. */
function recordAmbiguousLocalBinding(
  localName: string,
  state: ScriptState
): void {
  state.analysis.uncertainComponents.add(localName);
  state.analysis.uncertainGTComponents.add(localName);
  state.analysis.uncertainStringFunctions.add(localName);
}

/** Reads the original name of one direct or namespace ESM import. */
function readImportedFunctionName(
  node: t.Node,
  scope: Scope,
  source: 'gt-vue' | 'vue',
  state: ScriptState
): string | undefined {
  const known = resolveKnownExpression(node, scope, state, new Set());
  if (source === 'vue' && known?.type === 'vue-call') return known.name;
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const importPath = binding?.path;
    const declaration = importPath?.parentPath;
    if (
      !importPath?.isImportSpecifier() ||
      !declaration?.isImportDeclaration() ||
      declaration.node.source.value !== source
    ) {
      return undefined;
    }
    return importPath.node.imported.type === 'Identifier'
      ? importPath.node.imported.name
      : importPath.node.imported.value;
  }
  if (
    expression.type !== 'MemberExpression' &&
    expression.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  const property = readMemberProperty(expression);
  const object = unwrapExpression(expression.object);
  if (!property || object?.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(object.name);
  const importPath = binding?.path;
  const declaration = importPath?.parentPath;
  return importPath?.isImportNamespaceSpecifier() &&
    declaration?.isImportDeclaration() &&
    declaration.node.source.value === source
    ? property
    : undefined;
}

/** Detects an imported T anywhere inside an unsupported wrapper expression. */
function expressionContainsGTReference(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): boolean {
  const direct = resolveKnownExpression(node, scope, state, new Set());
  if (direct?.type === 'component' && direct.name === 'T') return true;
  const path = state.paths.get(node);
  if (!path) return false;
  let found = false;
  path.traverse({
    Identifier(identifierPath) {
      const value = resolveKnownExpression(
        identifierPath.node,
        identifierPath.scope,
        state,
        new Set()
      );
      if (value?.type === 'component' && value.name === 'T') {
        found = true;
        identifierPath.stop();
      }
    },
  });
  return found;
}

function registerImport(
  localName: string,
  value: KnownValue,
  scope: Scope,
  state: ScriptState
): void {
  const binding = scope.getBinding(localName);
  if (!binding || binding.constant) {
    if (binding) state.bindings.set(binding, value);
    if (
      binding?.scope.block === state.entryProgram &&
      (value.type !== 'namespace' || !value.mutable)
    ) {
      state.analysis.values.set(localName, value);
    }
  }
}

function registerRequirePattern(
  pattern: t.Node,
  namespace: Extract<KnownValue, { type: 'namespace' }>,
  scope: Scope,
  state: ScriptState
): void {
  if (pattern.type === 'Identifier') {
    registerImport(pattern.name, namespace, scope, state);
    const binding = scope.getBinding(pattern.name);
    if (binding) state.mutableImportSources.set(binding, namespace.source);
    return;
  }
  if (pattern.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty') continue;
    const importedName = readResolvedPropertyKey(property, scope, state);
    const localName = readPatternIdentifier(property.value);
    const value = importedName
      ? knownExport(namespace.source, importedName)
      : undefined;
    if (localName && value) {
      registerImport(localName, value, scope, state);
      const binding = scope.getBinding(localName);
      if (binding) {
        state.mutableImportSources.set(binding, namespace.source);
        if (!binding.constant) {
          exposeUncertainKnownValue(
            localName,
            value,
            state.analysis.uncertainComponents,
            state.analysis.uncertainGTComponents,
            state.analysis.uncertainStringFunctions
          );
        }
      }
    }
  }
}

function exposeProgramBindings(
  ast: t.File,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  for (const name of state.analysis.uncertainComponents) {
    templateBindings.uncertainComponents.add(name);
  }
  for (const name of state.analysis.uncertainGTComponents) {
    templateBindings.uncertainGTComponents.add(name);
  }
  for (const name of state.analysis.uncertainStringFunctions) {
    templateBindings.uncertainStringFunctions.add(name);
  }
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        clearTemplateBinding(name, templateBindings);
        templateBindings.directBindings.add(name);
        if (state.analysis.uncertainComponents.has(name)) {
          templateBindings.uncertainComponents.add(name);
        }
        if (state.analysis.uncertainGTComponents.has(name)) {
          templateBindings.uncertainGTComponents.add(name);
        }
        if (state.analysis.uncertainStringFunctions.has(name)) {
          templateBindings.uncertainStringFunctions.add(name);
        }
        const replayLeaf = readReplayLeafState(binding, state);
        const exactReplayLeaf = readSafeReplayLeafOverride(
          binding,
          replayLeaf,
          state
        );
        const value = exactReplayLeaf
          ? exactReplayLeaf.value.knownValue
          : resolveTemplateKnownBinding(binding, state);
        const unsafeMutableImport = readUnsafeMutableImport(binding, state);
        const unsafeReplaySource = bindingReadsUnsafeMutableImport(
          binding,
          state
        );
        const exactReplayComponents =
          Boolean(exactReplayLeaf) ||
          (!unsafeReplaySource &&
            readReplayComponentCandidates(binding, name, state) !== undefined);
        if (value && !unsafeMutableImport) {
          exposeKnownValue(name, value, templateBindings, state.analysis);
        } else if (replayLeaf?.status === 'unsafe') {
          templateBindings.uncertainComponents.add(name);
          templateBindings.uncertainGTComponents.add(name);
          templateBindings.uncertainStringFunctions.add(name);
        } else if (unsafeMutableImport) {
          exposeUncertainKnownValue(
            name,
            unsafeMutableImport,
            templateBindings.uncertainComponents,
            templateBindings.uncertainGTComponents,
            templateBindings.uncertainStringFunctions
          );
        } else if (
          !exactReplayComponents &&
          bindingMayReferenceComponent(binding, state)
        ) {
          templateBindings.uncertainComponents.add(name);
        }
        if (
          replayLeaf?.status !== 'unsafe' &&
          !exactReplayComponents &&
          bindingMayReferenceComponent(binding, state, 'translation')
        ) {
          templateBindings.uncertainGTComponents.add(name);
        }
        if (
          !value &&
          !exactReplayLeaf &&
          replayLeaf?.status !== 'unsafe' &&
          bindingMayReferenceStringFunction(binding, state)
        ) {
          templateBindings.uncertainStringFunctions.add(name);
        }
        exposeProgramComponentMembers(name, binding, state, templateBindings);
        exposeProgramComponentFactory(name, binding, state, templateBindings);
        exposeProgramContainerKinds(name, binding, state, templateBindings);
        const gtContainer = readBindingGTContainerExposure(binding, state);
        for (const path of gtContainer.containers) {
          templateBindings.possibleGTContainers.add(path);
        }
        for (const path of gtContainer.factories) {
          templateBindings.gtContainerFactories.add(path);
        }
        exposeProgramStaticMembers(name, binding, state, templateBindings);
        exposeProgramPossibleStaticStrings(
          name,
          binding,
          state,
          templateBindings
        );
        const staticValue = readStaticFromScope(
          binding.identifier,
          path.scope,
          new Set(),
          Number.POSITIVE_INFINITY,
          state.analysis
        );
        if (staticValue.ok) {
          templateBindings.staticValues.set(name, staticValue.value);
        }
      }
      path.stop();
    },
  });
}

/** Invalidates normal-script values written from the script-setup block. */
function recordCrossBlockWrites(
  ast: t.File,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const applyWrite = (target: t.Node, scope: Scope, value?: t.Node): void => {
    for (const path of collectCrossBlockWritePaths(target, scope, state)) {
      const existingValues = [...readAnalysisPathValues(path, state.analysis)];
      const hadComponent =
        existingValues.some(
          (entry) => entry.type === 'component' || entry.type === 'vue-builtin'
        ) || setHasPath(state.analysis.uncertainComponents, path);
      const hadGTComponent =
        existingValues.some((entry) => entry.type === 'component') ||
        setHasPath(state.analysis.uncertainGTComponents, path);
      const hadString =
        existingValues.some((entry) => entry.type === 'string') ||
        setHasPath(state.analysis.uncertainStringFunctions, path);
      invalidateAnalysisPath(path, state.analysis);
      clearTemplateBinding(path, templateBindings);

      const valueHasComponent = Boolean(
        value &&
        (expressionMayProduceComponent(value, scope, state, new Set()) ||
          containerMayContainComponent(value, scope, state, new Set()))
      );
      const valueHasGTComponent = Boolean(
        value &&
        (expressionMayProduceComponent(
          value,
          scope,
          state,
          new Set(),
          'translation'
        ) ||
          containerMayContainComponent(
            value,
            scope,
            state,
            new Set(),
            'translation'
          ))
      );
      const valueHasString = Boolean(
        value &&
        (expressionMayProduceStringFunction(value, scope, state, new Set()) ||
          containerMayContainStringFunction(value, scope, state, new Set()))
      );
      if (hadComponent || valueHasComponent) {
        state.analysis.uncertainComponents.add(path);
        templateBindings.uncertainComponents.add(path);
      }
      if (hadGTComponent || valueHasGTComponent) {
        state.analysis.uncertainGTComponents.add(path);
        templateBindings.uncertainGTComponents.add(path);
      }
      if (hadString || valueHasString) {
        state.analysis.uncertainStringFunctions.add(path);
        templateBindings.uncertainStringFunctions.add(path);
      }
    }
  };

  traverse(ast, {
    AssignmentExpression(path) {
      applyWrite(path.node.left, path.scope, path.node.right);
    },
    UpdateExpression(path) {
      applyWrite(path.node.argument, path.scope);
    },
    UnaryExpression(path) {
      if (path.node.operator === 'delete') {
        applyWrite(path.node.argument, path.scope);
      }
    },
    ForInStatement(path) {
      applyWrite(path.node.left, path.scope, path.node.right);
    },
    ForOfStatement(path) {
      applyWrite(path.node.left, path.scope, path.node.right);
    },
  });
}

function collectCrossBlockWritePaths(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): string[] {
  const expression = unwrapExpression(node);
  if (!expression) return [];
  if (expression.type === 'Identifier') {
    return !scope.getBinding(expression.name) &&
      state.analysis.directBindings.has(expression.name)
      ? [expression.name]
      : [];
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const root = readMemberRootName(expression);
    if (
      !root ||
      scope.getBinding(root) ||
      !state.analysis.directBindings.has(root)
    ) {
      return [];
    }
    return [readResolvedMemberPath(expression, scope, state) ?? root];
  }
  if (expression.type === 'ObjectPattern') {
    return expression.properties.flatMap((property) =>
      collectCrossBlockWritePaths(
        property.type === 'RestElement' ? property.argument : property.value,
        scope,
        state
      )
    );
  }
  if (expression.type === 'ArrayPattern') {
    return expression.elements.flatMap((element) =>
      element ? collectCrossBlockWritePaths(element, scope, state) : []
    );
  }
  if (expression.type === 'RestElement') {
    return collectCrossBlockWritePaths(expression.argument, scope, state);
  }
  if (expression.type === 'AssignmentPattern') {
    return collectCrossBlockWritePaths(expression.left, scope, state);
  }
  return [];
}

function readMemberRootName(node: t.Node): string | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (expression.type === 'Identifier') return expression.name;
  return expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
    ? readMemberRootName(expression.object)
    : undefined;
}

function readAnalysisPathValues(
  path: string,
  analysis: VueScriptAnalysis
): KnownValue[] {
  const values: KnownValue[] = [];
  for (const source of [analysis.values, analysis.templateValues]) {
    for (const [name, value] of source) {
      if (name === path || name.startsWith(`${path}.`)) values.push(value);
    }
  }
  return values;
}

function setHasPath(values: Set<string>, path: string): boolean {
  return [...values].some(
    (name) => name === path || name.startsWith(`${path}.`)
  );
}

/** Checks whether a dotted path is nested under one retained set entry. */
function pathHasSetPrefix(values: Set<string>, path: string): boolean {
  return [...values].some(
    (name) => name === path || path.startsWith(`${name}.`)
  );
}

/** Checks helper uncertainty against the active lexical binding when present. */
function pathMayReferenceUncertainTranslationHelper(
  node: t.Node,
  path: string,
  scope: Scope,
  state: ScriptState
): boolean {
  const rootName = readMemberRootName(node);
  const binding = rootName ? scope.getBinding(rootName) : undefined;
  if (!binding) {
    return pathHasSetPrefix(state.analysis.uncertainTranslationHelpers, path);
  }
  if (state.uncertainTranslationHelperBindings.has(binding)) return true;

  const known = state.bindings.get(binding);
  const isLocalNamespace = known?.type === 'local-namespace';
  return (
    (binding.path.isImportNamespaceSpecifier() || isLocalNamespace) &&
    pathHasSetPrefix(state.analysis.uncertainTranslationHelpers, path)
  );
}

function invalidateAnalysisPath(
  path: string,
  analysis: VueScriptAnalysis
): void {
  for (const map of [
    analysis.arrayLengths,
    analysis.possibleStaticStrings,
    analysis.values,
    analysis.templateValues,
    analysis.staticValues,
    analysis.containerKinds,
  ]) {
    for (const name of map.keys()) {
      if (name === path || name.startsWith(`${path}.`)) map.delete(name);
    }
  }
  for (const values of [
    analysis.componentFactories,
    analysis.gtComponentFactories,
    analysis.gtContainerFactories,
    analysis.possibleGTContainers,
    analysis.uncertainComponents,
    analysis.uncertainGTComponents,
    analysis.uncertainStringFunctions,
  ]) {
    for (const name of values) {
      if (name === path || name.startsWith(`${path}.`)) values.delete(name);
    }
  }
}

/** Removes a normal-script exposure shadowed by a script-setup binding. */
function clearTemplateBinding(
  localName: string,
  templateBindings: TemplateBindings
): void {
  for (const bindings of [
    templateBindings.arrayLengths,
    templateBindings.possibleStaticStrings,
    templateBindings.staticValues,
    templateBindings.containerKinds,
  ]) {
    for (const name of bindings.keys()) {
      if (name === localName || name.startsWith(`${localName}.`)) {
        bindings.delete(name);
      }
    }
  }
  templateBindings.uncertainComponents.delete(localName);
  templateBindings.uncertainGTComponents.delete(localName);
  templateBindings.uncertainStringFunctions.delete(localName);
  for (const bindings of [
    templateBindings.components,
    templateBindings.stringFunctions,
    templateBindings.vueBuiltins,
  ]) {
    for (const name of bindings.keys()) {
      if (name === localName || name.startsWith(`${localName}.`)) {
        bindings.delete(name);
      }
    }
  }
  for (const bindings of [
    templateBindings.componentFactories,
    templateBindings.gtComponentFactories,
    templateBindings.gtContainerFactories,
    templateBindings.identityFunctions,
    templateBindings.possibleGTContainers,
  ]) {
    for (const name of bindings) {
      if (name === localName || name.startsWith(`${localName}.`)) {
        bindings.delete(name);
      }
    }
  }
  for (const name of templateBindings.uncertainComponents) {
    if (name.startsWith(`${localName}.`)) {
      templateBindings.uncertainComponents.delete(name);
    }
  }
  for (const name of templateBindings.uncertainGTComponents) {
    if (name.startsWith(`${localName}.`)) {
      templateBindings.uncertainGTComponents.delete(name);
    }
  }
  for (const name of templateBindings.uncertainStringFunctions) {
    if (name.startsWith(`${localName}.`)) {
      templateBindings.uncertainStringFunctions.delete(name);
    }
  }
}

/** Records normal-script module bindings that script setup can reference. */
function recordProgramAnalysis(ast: t.File, state: ScriptState): void {
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        state.analysis.directBindings.add(name);
        const replayLeaf = readReplayLeafState(binding, state);
        const exactReplayLeaf = readSafeReplayLeafOverride(
          binding,
          replayLeaf,
          state
        );
        const replayKnownValue = exactReplayLeaf
          ? exactReplayLeaf.value.knownValue
          : undefined;
        const value = exactReplayLeaf
          ? replayKnownValue
          : resolveKnownBinding(binding, state, new Set());
        const templateValue = exactReplayLeaf
          ? replayKnownValue
          : resolveTemplateKnownBinding(binding, state);
        const unsafeMutableImport = readUnsafeMutableImport(binding, state);
        const unsafeReplaySource = bindingReadsUnsafeMutableImport(
          binding,
          state
        );
        const exactReplayComponents =
          Boolean(exactReplayLeaf) ||
          (!unsafeReplaySource &&
            readReplayComponentCandidates(binding, name, state) !== undefined);
        if (value && !unsafeMutableImport) {
          state.analysis.values.set(name, value);
        } else if (replayLeaf?.status === 'unsafe') {
          state.analysis.uncertainComponents.add(name);
          state.analysis.uncertainGTComponents.add(name);
          state.analysis.uncertainStringFunctions.add(name);
        } else if (unsafeMutableImport) {
          exposeUncertainKnownValue(
            name,
            unsafeMutableImport,
            state.analysis.uncertainComponents,
            state.analysis.uncertainGTComponents,
            state.analysis.uncertainStringFunctions
          );
        } else if (
          !exactReplayComponents &&
          bindingMayReferenceComponent(binding, state)
        ) {
          state.analysis.uncertainComponents.add(name);
        }
        if (
          replayLeaf?.status !== 'unsafe' &&
          !exactReplayComponents &&
          bindingMayReferenceComponent(binding, state, 'translation')
        ) {
          state.analysis.uncertainGTComponents.add(name);
        }
        if (
          !templateValue &&
          !exactReplayLeaf &&
          replayLeaf?.status !== 'unsafe' &&
          bindingMayReferenceStringFunction(binding, state)
        ) {
          state.analysis.uncertainStringFunctions.add(name);
        }
        if (
          templateValue &&
          (!value || knownValueKey(value) !== knownValueKey(templateValue))
        ) {
          state.analysis.templateValues.set(name, templateValue);
        }
        recordProgramComponentMembers(name, binding, state);
        recordProgramComponentFactory(name, binding, state);
        recordProgramContainerKinds(name, binding, state);
        const gtContainer = readBindingGTContainerExposure(binding, state);
        for (const path of gtContainer.containers) {
          state.analysis.possibleGTContainers.add(path);
        }
        for (const path of gtContainer.factories) {
          state.analysis.gtContainerFactories.add(path);
        }
        recordProgramStaticMembers(name, binding, state);
        recordProgramPossibleStaticStrings(name, binding, state);
        const staticValue = readStaticFromScope(
          binding.identifier,
          path.scope,
          new Set(),
          Number.POSITIVE_INFINITY,
          state.analysis
        );
        if (staticValue.ok) {
          state.analysis.staticValues.set(name, staticValue.value);
        }
      }
      path.stop();
    },
  });
}

function exposeKnownValue(
  localName: string,
  value: KnownValue,
  templateBindings: TemplateBindings,
  analysis?: VueScriptAnalysis
): void {
  if (value.type === 'component') {
    templateBindings.components.set(localName, value.name);
  } else if (value.type === 'string') {
    templateBindings.stringFunctions.set(localName, value.kind);
  } else if (value.type === 'namespace' && value.source === 'gt-vue') {
    for (const component of COMPONENT_IMPORTS) {
      templateBindings.components.set(
        appendTemplatePath(localName, component),
        component
      );
    }
    templateBindings.stringFunctions.set(
      appendTemplatePath(localName, 'msg'),
      'msg'
    );
    templateBindings.stringFunctions.set(
      appendTemplatePath(localName, 't'),
      't'
    );
  } else if (value.type === 'namespace' && value.source === 'vue') {
    for (const builtin of VUE_BUILTIN_IMPORTS) {
      templateBindings.vueBuiltins.set(
        appendTemplatePath(localName, builtin),
        builtin
      );
    }
    templateBindings.identityFunctions.add(
      appendTemplatePath(localName, 'markRaw')
    );
  } else if (value.type === 'local-namespace' && analysis) {
    const prefix = `${localName}.`;
    for (const [path, member] of analysis.values) {
      if (path.startsWith(prefix) && path !== localName) {
        exposeKnownValue(path, member, templateBindings, analysis);
      }
    }
    for (const path of analysis.uncertainComponents) {
      if (path.startsWith(prefix)) {
        templateBindings.uncertainComponents.add(path);
      }
    }
    for (const path of analysis.uncertainGTComponents) {
      if (path.startsWith(prefix)) {
        templateBindings.uncertainGTComponents.add(path);
      }
    }
    for (const path of analysis.uncertainStringFunctions) {
      if (path.startsWith(prefix)) {
        templateBindings.uncertainStringFunctions.add(path);
      }
    }
  } else if (value.type === 'vue-builtin') {
    templateBindings.vueBuiltins.set(localName, value.name);
  } else if (value.type === 'identity') {
    templateBindings.identityFunctions.add(localName);
  }
}

/** Reads the original export identity for an unsafe CommonJS import binding. */
function readUnsafeMutableImport(
  binding: Binding,
  state: ScriptState
): KnownValue | undefined {
  const source = state.mutableImportSources.get(binding);
  const value = state.bindings.get(binding);
  if (!source || !value) return undefined;
  const unsafe =
    state.unsafeMutableNamespaceSources.has(source) ||
    (value.type === 'namespace' &&
      value.mutable &&
      !isSafeMutableNamespaceBinding(binding));
  return unsafe ? value : undefined;
}

/** Detects a derived binding whose root still comes from mutable CommonJS. */
function bindingReadsUnsafeMutableImport(
  binding: Binding,
  state: ScriptState
): boolean {
  const source = getBindingSource(binding);
  if (!source) return false;
  let expression = unwrapExpression(source.expression.node);
  while (
    expression?.type === 'MemberExpression' ||
    expression?.type === 'OptionalMemberExpression'
  ) {
    expression = unwrapExpression(expression.object);
  }
  if (expression?.type !== 'Identifier') return false;
  const rootBinding = source.expression.scope.getBinding(expression.name);
  if (!rootBinding) return false;
  const mutableSource = state.mutableImportSources.get(rootBinding);
  return Boolean(
    mutableSource &&
    (state.unsafeMutableNamespaceSources.has(mutableSource) ||
      !isSafeMutableNamespaceBinding(rootBinding))
  );
}

/** Records only the exact component names reachable from an unsafe import. */
function exposeUncertainKnownValue(
  localName: string,
  value: KnownValue,
  uncertainComponents: Set<string>,
  uncertainGTComponents: Set<string>,
  uncertainStringFunctions: Set<string>
): void {
  if (value.type === 'component') {
    uncertainComponents.add(localName);
    uncertainGTComponents.add(localName);
  } else if (value.type === 'vue-builtin') {
    uncertainComponents.add(localName);
  } else if (value.type === 'string' || value.type === 'hook') {
    uncertainStringFunctions.add(localName);
  } else if (value.type === 'namespace' && value.source === 'gt-vue') {
    for (const component of COMPONENT_IMPORTS) {
      uncertainComponents.add(appendTemplatePath(localName, component));
      uncertainGTComponents.add(appendTemplatePath(localName, component));
    }
    uncertainStringFunctions.add(appendTemplatePath(localName, 'msg'));
    uncertainStringFunctions.add(appendTemplatePath(localName, 't'));
  } else if (value.type === 'namespace' && value.source === 'vue') {
    for (const builtin of VUE_BUILTIN_IMPORTS) {
      uncertainComponents.add(appendTemplatePath(localName, builtin));
    }
  }
}

/** Exposes a callable whose return can affect template component identity. */
function exposeProgramComponentFactory(
  localName: string,
  binding: Binding,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const replay = readReplayComponentFactoryCandidates(
    binding,
    localName,
    state
  );
  if (replay) {
    for (const candidate of replay) {
      templateBindings.componentFactories.add(candidate.name);
      if (candidate.gt) {
        templateBindings.gtComponentFactories.add(candidate.name);
      }
    }
    return;
  }
  const factory = readProgramComponentFactory(binding, state);
  if (factory) {
    templateBindings.componentFactories.add(localName);
    if (factory.gt) templateBindings.gtComponentFactories.add(localName);
  }
  for (const candidate of collectProgramComponentFactoryMembers(
    localName,
    binding,
    state
  )) {
    templateBindings.componentFactories.add(candidate.name);
    if (candidate.gt) {
      templateBindings.gtComponentFactories.add(candidate.name);
    }
  }
}

/** Records a normal-script component factory for script-setup templates. */
function recordProgramComponentFactory(
  localName: string,
  binding: Binding,
  state: ScriptState
): void {
  const replay = readReplayComponentFactoryCandidates(
    binding,
    localName,
    state
  );
  if (replay) {
    for (const candidate of replay) {
      state.analysis.componentFactories.add(candidate.name);
      if (candidate.gt) {
        state.analysis.gtComponentFactories.add(candidate.name);
      }
    }
    return;
  }
  const factory = readProgramComponentFactory(binding, state);
  if (factory) {
    state.analysis.componentFactories.add(localName);
    if (factory.gt) state.analysis.gtComponentFactories.add(localName);
  }
  for (const candidate of collectProgramComponentFactoryMembers(
    localName,
    binding,
    state
  )) {
    state.analysis.componentFactories.add(candidate.name);
    if (candidate.gt) state.analysis.gtComponentFactories.add(candidate.name);
  }
}

/** Determines whether a local callable may return GT and/or Vue identity. */
function readProgramComponentFactory(
  binding: Binding,
  state: ScriptState
): { gt: boolean } | undefined {
  return readComponentFactoryExpression(
    binding.identifier,
    binding.path.scope,
    state
  );
}

function readComponentFactoryExpression(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): { gt: boolean } | undefined {
  const called = resolveCalledFunction(node, scope, state, new Set());
  if (!called) return undefined;
  const gt = functionMayReturnComponent(
    called.node,
    called.scope,
    state,
    new Set(),
    'translation'
  );
  const vue = functionMayReturnComponent(
    called.node,
    called.scope,
    state,
    new Set(),
    'vue'
  );
  return gt || vue ? { gt } : undefined;
}

/** Finds callable component-producing members of an object or array binding. */
function collectProgramComponentFactoryMembers(
  localName: string,
  binding: Binding,
  state: ScriptState
): ComponentFactoryCandidate[] {
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    declaration.id.type !== 'Identifier' ||
    !declaration.init
  ) {
    return [];
  }
  return collectComponentFactoryCandidates(
    declaration.init,
    binding.path.scope,
    localName,
    state,
    new Set(),
    new Set([binding])
  ).filter((candidate) => candidate.name !== localName);
}

function collectComponentFactoryCandidates(
  node: t.Node,
  scope: Scope,
  name: string,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>
): ComponentFactoryCandidate[] {
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return [];
  const nextNodes = new Set(seenNodes).add(expression);
  const called = resolveCalledFunction(expression, scope, state, new Set());
  if (called) {
    const gt = functionMayReturnComponent(
      called.node,
      called.scope,
      state,
      new Set(),
      'translation'
    );
    const vue = functionMayReturnComponent(
      called.node,
      called.scope,
      state,
      new Set(),
      'vue'
    );
    return gt || vue ? [{ gt, name }] : [];
  }
  if (expression.type === 'Identifier') {
    const source = scope.getBinding(expression.name);
    if (!source || seenBindings.has(source)) return [];
    const bindingSource = getBindingSource(source);
    if (bindingSource?.pattern.type !== 'Identifier') return [];
    const cacheable = state.parameterSubstitutions.length === 0;
    const remap = (candidate: ComponentFactoryCandidate) => ({
      ...candidate,
      name:
        candidate.name === source.identifier.name
          ? name
          : `${name}${candidate.name.slice(source.identifier.name.length)}`,
    });
    const cached = cacheable
      ? state.componentFactoryCandidates.get(source)
      : undefined;
    if (cached) return cached.map(remap);
    if (cacheable && state.componentFactoryCandidatesInProgress.has(source)) {
      return [];
    }
    if (cacheable) state.componentFactoryCandidatesInProgress.add(source);
    try {
      const candidates = collectComponentFactoryCandidates(
        bindingSource.expression.node,
        bindingSource.expression.scope,
        cacheable ? source.identifier.name : name,
        state,
        nextNodes,
        new Set(seenBindings).add(source)
      );
      if (!cacheable) return candidates;
      state.componentFactoryCandidates.set(source, candidates);
      return candidates.map(remap);
    } finally {
      if (cacheable) {
        state.componentFactoryCandidatesInProgress.delete(source);
      }
    }
  }
  if (expression.type === 'ObjectExpression') {
    return expression.properties.flatMap((property) => {
      if (property.type === 'SpreadElement') {
        return collectComponentFactoryCandidates(
          property.argument,
          scope,
          name,
          state,
          nextNodes,
          seenBindings
        );
      }
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) return [];
      return collectComponentFactoryCandidates(
        property.type === 'ObjectProperty' ? property.value : property,
        scope,
        appendTemplatePath(name, key),
        state,
        nextNodes,
        seenBindings
      );
    });
  }
  if (expression.type === 'ArrayExpression') {
    return expression.elements.flatMap((element, index) =>
      element
        ? collectComponentFactoryCandidates(
            element.type === 'SpreadElement' ? element.argument : element,
            scope,
            appendTemplatePath(name, String(index)),
            state,
            nextNodes,
            seenBindings
          )
        : []
    );
  }
  return [];
}

/** Exposes exact component-valued object members from one script-setup binding. */
function exposeProgramComponentMembers(
  localName: string,
  binding: Binding,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  for (const candidate of collectProgramComponentMembers(
    localName,
    binding,
    state
  )) {
    if (candidate.certain) {
      exposeKnownValue(
        candidate.name,
        candidate.value,
        templateBindings,
        state.analysis
      );
      continue;
    }
    if (candidate.value.type === 'component') {
      templateBindings.uncertainComponents.add(candidate.name);
      templateBindings.uncertainGTComponents.add(candidate.name);
    } else if (candidate.value.type === 'string') {
      templateBindings.uncertainStringFunctions.add(candidate.name);
    } else {
      templateBindings.uncertainComponents.add(candidate.name);
    }
  }
}

/** Records exact cross-block member names without a container-wide wildcard. */
function recordProgramComponentMembers(
  localName: string,
  binding: Binding,
  state: ScriptState
): void {
  for (const candidate of collectProgramComponentMembers(
    localName,
    binding,
    state
  )) {
    if (candidate.certain) {
      state.analysis.values.set(candidate.name, candidate.value);
      continue;
    }
    if (candidate.value.type === 'component') {
      state.analysis.uncertainComponents.add(candidate.name);
      state.analysis.uncertainGTComponents.add(candidate.name);
    } else if (candidate.value.type === 'string') {
      state.analysis.uncertainStringFunctions.add(candidate.name);
    } else {
      state.analysis.uncertainComponents.add(candidate.name);
    }
  }
}

/** Finds statically named component leaves in an object or array binding. */
function collectProgramComponentMembers(
  localName: string,
  binding: Binding,
  state: ScriptState
): ComponentMemberCandidate[] {
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) return [];
  if (declaration.id.type !== 'Identifier') {
    return [
      ...collectNamespaceRestMemberCandidates(
        localName,
        binding,
        declaration.id,
        declaration.init,
        state
      ),
      ...collectRestPatternMemberCandidates(
        localName,
        binding,
        declaration.id,
        declaration.init,
        state
      ),
    ];
  }
  const replayCandidates = readReplayComponentCandidates(
    binding,
    localName,
    state
  );
  if (replayCandidates) return replayCandidates;
  const finalSnapshot = readDefiniteFinalContainerSnapshot(binding, state);
  if (finalSnapshot) {
    const entries =
      finalSnapshot.kind === 'array'
        ? finalSnapshot.entries.map(
            (value, index) => [String(index), value] as const
          )
        : [...finalSnapshot.entries];
    return entries.flatMap(([key, value]) =>
      value
        ? collectComponentMemberCandidates(
            value.node,
            value.scope,
            appendTemplatePath(localName, key),
            state,
            true,
            new Set(),
            new Set([binding])
          )
        : []
    );
  }
  const certain = isSafelyReadContainerBinding(
    binding,
    binding.identifier,
    Number.POSITIVE_INFINITY,
    false,
    state
  );
  const candidates = collectComponentMemberCandidates(
    declaration.init,
    binding.path.scope,
    localName,
    state,
    certain,
    new Set(),
    new Set([binding])
  );
  candidates.push(...collectMemberWriteCandidates(localName, binding, state));
  const byName = new Map<string, ComponentMemberCandidate>();
  for (const candidate of candidates) {
    if (candidate.name !== localName) byName.set(candidate.name, candidate);
  }
  return [...byName.values()];
}

type DirectRestPattern =
  | { type: 'array'; start: number }
  | { type: 'object'; excluded: Set<string>; hasDynamicExclusion: boolean };

/** Remaps flattened source paths to the indices/keys created by rest syntax. */
function remapDirectRestPaths<T>(
  localName: string,
  rest: DirectRestPattern,
  source: Map<string, T>
): Map<string, T> {
  const result = new Map<string, T>();
  for (const [path, value] of source) {
    if (path === localName || !path.startsWith(`${localName}.`)) continue;
    const suffix = path.slice(localName.length + 1);
    const [first, ...restPath] = suffix.split('.');
    if (rest.type === 'object') {
      if (!rest.excluded.has(first) && !rest.hasDynamicExclusion) {
        result.set(path, value);
      }
      continue;
    }
    const index = first.match(/^(0|[1-9]\d*)$/) ? Number(first) : undefined;
    if (index === undefined || index < rest.start) continue;
    result.set(
      `${appendTemplatePath(localName, String(index - rest.start))}${
        restPath.length > 0 ? `.${restPath.join('.')}` : ''
      }`,
      value
    );
  }
  return result;
}

/** Reads a direct object/array rest target for one bound identifier. */
function readDirectRestPattern(
  pattern: t.Node,
  localName: string,
  scope: Scope,
  state: ScriptState
): DirectRestPattern | undefined {
  if (pattern.type === 'ArrayPattern') {
    const start = pattern.elements.findIndex(
      (element) =>
        element?.type === 'RestElement' &&
        element.argument.type === 'Identifier' &&
        element.argument.name === localName
    );
    return start >= 0 ? { type: 'array', start } : undefined;
  }
  if (pattern.type !== 'ObjectPattern') return undefined;
  const hasRest = pattern.properties.some(
    (property) =>
      property.type === 'RestElement' &&
      property.argument.type === 'Identifier' &&
      property.argument.name === localName
  );
  if (!hasRest) return undefined;
  const excluded = new Set<string>();
  let hasDynamicExclusion = false;
  for (const property of pattern.properties) {
    if (property.type !== 'ObjectProperty') continue;
    const key = readResolvedPropertyKey(property, scope, state);
    if (key !== undefined) excluded.add(appendTemplatePath('', key).slice(1));
    else hasDynamicExclusion = true;
  }
  return { type: 'object', excluded, hasDynamicExclusion };
}

/** Maps component/string leaves copied into a direct rest binding. */
function collectRestPatternMemberCandidates(
  localName: string,
  binding: Binding,
  pattern: t.Node,
  value: t.Expression,
  state: ScriptState
): ComponentMemberCandidate[] {
  const rest = readDirectRestPattern(
    pattern,
    localName,
    binding.path.scope,
    state
  );
  if (!rest) return [];
  const sourceIsKnown = componentContainerShapeIsKnown(
    value,
    binding.path.scope,
    state,
    new Set(),
    value.end ?? Number.POSITIVE_INFINITY
  );
  const certain =
    sourceIsKnown &&
    isSafelyReadContainerBinding(
      binding,
      binding.identifier,
      Number.POSITIVE_INFINITY,
      true,
      state
    );
  const candidates = collectComponentMemberCandidates(
    value,
    binding.path.scope,
    localName,
    state,
    certain,
    new Set(),
    new Set(),
    Number.POSITIVE_INFINITY
  );
  return candidates.flatMap((candidate) => {
    const suffix = candidate.name.slice(localName.length + 1);
    const [first, ...restPath] = suffix.split('.');
    if (rest.type === 'object') {
      return rest.excluded.has(first)
        ? []
        : [
            {
              ...candidate,
              certain: candidate.certain && !rest.hasDynamicExclusion,
            },
          ];
    }
    const index = first.match(/^(0|[1-9]\d*)$/) ? Number(first) : undefined;
    if (index === undefined || index < rest.start) return [];
    return [
      {
        ...candidate,
        name: `${appendTemplatePath(localName, String(index - rest.start))}${
          restPath.length > 0 ? `.${restPath.join('.')}` : ''
        }`,
      },
    ];
  });
}

/** Exposes statically named exports copied by an object-rest namespace binding. */
function collectNamespaceRestMemberCandidates(
  localName: string,
  binding: Binding,
  pattern: t.Node,
  value: t.Expression,
  state: ScriptState
): ComponentMemberCandidate[] {
  if (pattern.type !== 'ObjectPattern') return [];
  const rest = pattern.properties.find(
    (property): property is t.RestElement =>
      property.type === 'RestElement' &&
      property.argument.type === 'Identifier' &&
      property.argument.name === localName
  );
  if (!rest) return [];
  const namespace = resolveNamespaceOrigin(
    value,
    binding.path.scope,
    state,
    new Set()
  );
  if (!namespace) return [];
  const excluded = new Set(
    pattern.properties.flatMap((property) => {
      if (property.type !== 'ObjectProperty') return [];
      const key = readResolvedPropertyKey(property, binding.path.scope, state);
      return key !== undefined ? [key] : [];
    })
  );
  const certain = isSafelyReadContainerBinding(
    binding,
    binding.identifier,
    Number.POSITIVE_INFINITY,
    true,
    state
  );
  const exports: TemplateKnownValue[] =
    namespace.source === 'gt-vue'
      ? [
          ...[...COMPONENT_IMPORTS].map(
            (name): TemplateKnownValue => ({ type: 'component', name })
          ),
          { type: 'string', kind: 'msg' },
          { type: 'string', kind: 't' },
        ]
      : [...VUE_BUILTIN_IMPORTS].map(
          (name): TemplateKnownValue => ({ type: 'vue-builtin', name })
        );
  return exports
    .filter((entry) => {
      const name =
        entry.type === 'component'
          ? entry.name
          : entry.type === 'string'
            ? entry.kind
            : entry.name;
      return !excluded.has(name);
    })
    .map((entry) => ({
      certain,
      name: appendTemplatePath(
        localName,
        entry.type === 'component'
          ? entry.name
          : entry.type === 'string'
            ? entry.kind
            : entry.name
      ),
      value: entry,
    }));
}

/** Exposes the static array/object shape of one script-setup binding. */
function exposeProgramContainerKinds(
  localName: string,
  binding: Binding,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  for (const [name, kind] of collectProgramContainerKinds(
    localName,
    binding,
    state
  )) {
    templateBindings.containerKinds.set(name, kind);
  }
  for (const [name, length] of collectProgramArrayLengths(
    localName,
    binding,
    state
  )) {
    templateBindings.arrayLengths.set(name, length);
  }
}

/** Records normal-script container shapes for a combined script-setup SFC. */
function recordProgramContainerKinds(
  localName: string,
  binding: Binding,
  state: ScriptState
): void {
  for (const [name, kind] of collectProgramContainerKinds(
    localName,
    binding,
    state
  )) {
    state.analysis.containerKinds.set(name, kind);
  }
  for (const [name, length] of collectProgramArrayLengths(
    localName,
    binding,
    state
  )) {
    state.analysis.arrayLengths.set(name, length);
  }
}

function collectProgramContainerKinds(
  localName: string,
  binding: Binding,
  state: ScriptState
): Map<string, TemplateContainerKind> {
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return new Map();
  }
  if (declaration.id.type !== 'Identifier') {
    const namespace = collectNamespaceRestContainerKind(
      localName,
      binding,
      declaration.id,
      declaration.init,
      state
    );
    return namespace.size > 0
      ? namespace
      : collectRestPatternContainerKinds(
          localName,
          binding,
          declaration.id,
          declaration.init,
          state
        );
  }
  const replay = readReplayContainerMetadata(binding, localName, state);
  if (replay) return replay.kinds;
  const result = collectContainerKinds(
    declaration.init,
    binding.path.scope,
    localName,
    state,
    new Set(),
    new Set([binding]),
    Number.POSITIVE_INFINITY
  );
  if (
    isSafelyReadContainerBinding(
      binding,
      binding.identifier,
      Number.POSITIVE_INFINITY,
      false,
      state
    )
  ) {
    return result;
  }
  const rootKind = result.get(localName);
  return rootKind ? new Map([[localName, rootKind]]) : new Map();
}

/** Maps statically known container paths copied by a direct rest binding. */
function collectRestPatternContainerKinds(
  localName: string,
  binding: Binding,
  pattern: t.Node,
  value: t.Expression,
  state: ScriptState
): Map<string, TemplateContainerKind> {
  const rest = readDirectRestPattern(
    pattern,
    localName,
    binding.path.scope,
    state
  );
  if (!rest) return new Map();
  const sourceKinds = collectContainerKinds(
    value,
    binding.path.scope,
    localName,
    state,
    new Set(),
    new Set(),
    Number.POSITIVE_INFINITY
  );
  const result = remapDirectRestPaths(localName, rest, sourceKinds);
  result.set(localName, rest.type);
  return result;
}

/** Records the object shape created by a namespace rest destructuring. */
function collectNamespaceRestContainerKind(
  localName: string,
  binding: Binding,
  pattern: t.Node,
  value: t.Expression,
  state: ScriptState
): Map<string, TemplateContainerKind> {
  if (
    pattern.type !== 'ObjectPattern' ||
    !pattern.properties.some(
      (property) =>
        property.type === 'RestElement' &&
        property.argument.type === 'Identifier' &&
        property.argument.name === localName
    ) ||
    !resolveNamespaceOrigin(value, binding.path.scope, state, new Set())
  ) {
    return new Map();
  }
  return new Map([[localName, 'object']]);
}

function collectProgramArrayLengths(
  localName: string,
  binding: Binding,
  state: ScriptState
): Map<string, number> {
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
    return new Map();
  }
  if (declaration.id.type === 'Identifier') {
    const replay = readReplayContainerMetadata(binding, localName, state);
    if (replay) return replay.arrayLengths;
  }
  if (
    !isSafelyReadContainerBinding(
      binding,
      binding.identifier,
      Number.POSITIVE_INFINITY,
      false,
      state
    )
  ) {
    return new Map();
  }
  if (declaration.id.type !== 'Identifier') {
    const rest = readDirectRestPattern(
      declaration.id,
      localName,
      binding.path.scope,
      state
    );
    if (rest?.type !== 'array') return new Map();
    const sourceLengths = new Map<string, number>();
    collectContainerKinds(
      declaration.init,
      binding.path.scope,
      localName,
      state,
      new Set(),
      new Set(),
      Number.POSITIVE_INFINITY,
      sourceLengths
    );
    const length = sourceLengths.get(localName);
    return length === undefined
      ? new Map()
      : new Map([[localName, Math.max(0, length - rest.start)]]);
  }
  const lengths = new Map<string, number>();
  collectContainerKinds(
    declaration.init,
    binding.path.scope,
    localName,
    state,
    new Set(),
    new Set([binding]),
    Number.POSITIVE_INFINITY,
    lengths
  );
  return lengths;
}

/** Exposes primitive leaves selected through a static container path. */
function exposeProgramStaticMembers(
  localName: string,
  binding: Binding,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  for (const [name, value] of collectProgramStaticMembers(
    localName,
    binding,
    state
  )) {
    if (name !== localName) templateBindings.staticValues.set(name, value);
  }
}

/** Records primitive normal-script leaves for a combined SFC template. */
function recordProgramStaticMembers(
  localName: string,
  binding: Binding,
  state: ScriptState
): void {
  for (const [name, value] of collectProgramStaticMembers(
    localName,
    binding,
    state
  )) {
    if (name !== localName) state.analysis.staticValues.set(name, value);
  }
}

function collectProgramStaticMembers(
  localName: string,
  binding: Binding,
  state: ScriptState
): Map<string, StaticPrimitive> {
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    !declaration.init ||
    !isSafelyReadContainerBinding(
      binding,
      binding.identifier,
      Number.POSITIVE_INFINITY,
      false,
      state
    )
  ) {
    return new Map();
  }
  if (declaration.id.type !== 'Identifier') {
    const rest = readDirectRestPattern(
      declaration.id,
      localName,
      binding.path.scope,
      state
    );
    if (!rest) return new Map();
    return remapDirectRestPaths(
      localName,
      rest,
      collectStaticMemberValues(
        declaration.init,
        binding.path.scope,
        localName,
        state,
        new Set(),
        new Set(),
        Number.POSITIVE_INFINITY
      )
    );
  }
  return collectStaticMemberValues(
    declaration.init,
    binding.path.scope,
    localName,
    state,
    new Set(),
    new Set([binding]),
    Number.POSITIVE_INFINITY
  );
}

/** Exposes statically visible string alternatives for template selectors. */
function exposeProgramPossibleStaticStrings(
  localName: string,
  binding: Binding,
  state: ScriptState,
  templateBindings: TemplateBindings
): void {
  const collected = collectProgramPossibleStaticStrings(
    localName,
    binding,
    state
  );
  for (const [name, values] of collected) {
    templateBindings.possibleStaticStrings.set(name, values);
  }
}

/** Records normal-script string alternatives for a combined SFC template. */
function recordProgramPossibleStaticStrings(
  localName: string,
  binding: Binding,
  state: ScriptState
): void {
  for (const [name, values] of collectProgramPossibleStaticStrings(
    localName,
    binding,
    state
  )) {
    state.analysis.possibleStaticStrings.set(name, values);
  }
}

function collectProgramPossibleStaticStrings(
  localName: string,
  binding: Binding,
  state: ScriptState
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const merge = (values: Map<string, Set<string>>): void => {
    for (const [path, strings] of values) {
      const existing = result.get(path) ?? new Set<string>();
      for (const value of strings) existing.add(value);
      result.set(path, existing);
    }
  };
  const source = getBindingSource(binding);
  const finalAssignment = source
    ? undefined
    : readDefiniteFinalBindingAssignment(binding);
  const selected = source
    ? selectPatternExpression(
        source.pattern,
        source.expression.node,
        localName,
        source.expression.scope,
        source.expression.node.end ?? Number.POSITIVE_INFINITY,
        state
      )
    : finalAssignment;
  if (selected) {
    merge(
      collectPossibleStaticStringMembers(
        selected.node,
        selected.scope,
        localName,
        state,
        new Set(),
        new Set([binding]),
        Number.POSITIVE_INFINITY
      )
    );
  }
  merge(bindingMutationPossibleStaticStrings(binding, state));
  return result;
}

/** Flattens possible string results while preserving their exact member path. */
function collectPossibleStaticStringMembers(
  node: t.Node,
  scope: Scope,
  name: string,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>,
  atPosition: number
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return result;
  const possible = collectPossibleStaticStrings(
    expression,
    scope,
    state,
    new Set()
  );
  if (possible.size > 0) result.set(name, possible);
  const nextNodes = new Set(seenNodes).add(expression);
  const mergeValues = (values: Map<string, Set<string>>): void => {
    for (const [path, strings] of values) {
      const existing = result.get(path) ?? new Set<string>();
      for (const value of strings) existing.add(value);
      result.set(path, existing);
    }
  };
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      const prefix = `${expression.name}.`;
      for (const [path, values] of state.analysis.possibleStaticStrings) {
        if (path === expression.name || path.startsWith(prefix)) {
          result.set(`${name}${path.slice(expression.name.length)}`, values);
        }
      }
      return result;
    }
    const substitution = readParameterSubstitution(binding, state);
    if (substitution) {
      mergeValues(
        collectPossibleStaticStringMembers(
          substitution.node,
          substitution.scope,
          name,
          state,
          nextNodes,
          seenBindings,
          atPosition
        )
      );
      return result;
    }
    if (seenBindings.has(binding)) return result;
    const cacheable =
      binding.constant && state.parameterSubstitutions.length === 0;
    const remapValues = (
      values: Map<string, Set<string>>,
      from: string,
      to: string
    ): Map<string, Set<string>> =>
      new Map(
        [...values].map(([path, strings]) => [
          path === from ? to : `${to}${path.slice(from.length)}`,
          new Set(strings),
        ])
      );
    const cached = cacheable
      ? state.possibleStaticStringMembers.get(binding)
      : undefined;
    if (cached) {
      mergeValues(remapValues(cached, binding.identifier.name, name));
      return result;
    }
    if (cacheable && state.possibleStaticStringMembersInProgress.has(binding)) {
      return result;
    }
    if (cacheable) state.possibleStaticStringMembersInProgress.add(binding);
    const source = getBindingSource(binding);
    const finalAssignment = source
      ? undefined
      : readDefiniteFinalBindingAssignment(binding);
    const selected = source
      ? selectPatternExpression(
          source.pattern,
          source.expression.node,
          binding.identifier.name,
          source.expression.scope,
          source.expression.node.end ?? atPosition,
          state
        )
      : finalAssignment;
    try {
      const canonicalName = cacheable ? binding.identifier.name : name;
      const canonical = new Map<string, Set<string>>();
      const mergeCanonical = (path: string, values: Set<string>): void => {
        const existing = canonical.get(path) ?? new Set<string>();
        for (const value of values) existing.add(value);
        canonical.set(path, existing);
      };
      if (possible.size > 0) mergeCanonical(canonicalName, possible);
      if (selected) {
        for (const [path, values] of collectPossibleStaticStringMembers(
          selected.node,
          selected.scope,
          canonicalName,
          state,
          nextNodes,
          new Set(seenBindings).add(binding),
          atPosition
        )) {
          mergeCanonical(path, values);
        }
      }
      for (const [path, values] of bindingMutationPossibleStaticStrings(
        binding,
        state
      )) {
        const targetPath = cacheable
          ? path
          : path === binding.identifier.name
            ? name
            : `${name}${path.slice(binding.identifier.name.length)}`;
        mergeCanonical(targetPath, values);
      }
      if (cacheable) {
        state.possibleStaticStringMembers.set(binding, canonical);
        mergeValues(remapValues(canonical, binding.identifier.name, name));
      } else {
        mergeValues(canonical);
      }
      return result;
    } finally {
      if (cacheable) {
        state.possibleStaticStringMembersInProgress.delete(binding);
      }
    }
  }
  if (expression.type === 'ObjectExpression') {
    const clearMember = (key: string) => {
      const member = appendTemplatePath(name, key);
      for (const path of result.keys()) {
        if (path === member || path.startsWith(`${member}.`)) {
          result.delete(path);
        }
      }
    };
    const replaceProperty = (
      key: string,
      property: t.ObjectProperty | t.ObjectMethod,
      propertyScope: Scope
    ) => {
      clearMember(key);
      if (property.type === 'ObjectProperty') {
        mergeValues(
          collectPossibleStaticStringMembers(
            property.value,
            propertyScope,
            appendTemplatePath(name, key),
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      } else if (property.kind === 'get') {
        const strings = collectFunctionPossibleStaticStrings(
          property,
          propertyScope,
          state
        );
        if (strings.size > 0) {
          result.set(appendTemplatePath(name, key), strings);
        }
      }
    };

    for (const property of expression.properties) {
      if (property.type !== 'SpreadElement') {
        const key = readResolvedPropertyKey(property, scope, state);
        if (key !== undefined) {
          replaceProperty(key, property, scope);
          continue;
        }
        const unknownValues =
          property.type === 'ObjectProperty'
            ? collectPossibleStaticStringMembers(
                property.value,
                scope,
                appendTemplatePath(name, unknownTemplatePathSegment),
                state,
                nextNodes,
                seenBindings,
                atPosition
              )
            : property.kind === 'get'
              ? new Map([
                  [
                    appendTemplatePath(name, unknownTemplatePathSegment),
                    collectFunctionPossibleStaticStrings(
                      property,
                      scope,
                      state
                    ),
                  ],
                ])
              : new Map<string, Set<string>>();
        const knownMembers = new Set(
          [...result.keys()]
            .filter((path) => path.startsWith(`${name}.`))
            .map((path) => path.slice(name.length + 1).split('.', 1)[0])
        );
        for (const key of knownMembers) {
          const remapped = new Map<string, Set<string>>();
          for (const [path, strings] of unknownValues) {
            remapped.set(
              path.replace(
                appendTemplatePath(name, unknownTemplatePathSegment),
                appendTemplatePath(name, key)
              ),
              strings
            );
          }
          mergeValues(remapped);
        }
        continue;
      }

      const spreadEntries = collectObjectEntries(
        property.argument,
        scope,
        new Set(seenNodes),
        property.argument.end ?? atPosition,
        state
      );
      const spreadValues = collectPossibleStaticStringMembers(
        property.argument,
        scope,
        name,
        state,
        nextNodes,
        seenBindings,
        property.argument.end ?? atPosition
      );
      const definiteKeys = new Set([
        ...spreadEntries.entries.keys(),
        ...spreadEntries.unknownNames,
      ]);
      for (const key of definiteKeys) clearMember(key);
      for (const [path, strings] of spreadValues) {
        const key = path.startsWith(`${name}.`)
          ? path.slice(name.length + 1).split('.', 1)[0]
          : undefined;
        if (!key || !spreadEntries.unknownAll || definiteKeys.has(key)) {
          result.set(path, strings);
        } else {
          mergeValues(new Map([[path, strings]]));
        }
      }
    }
    return result;
  }
  if (expression.type === 'ConditionalExpression') {
    const test = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? atPosition,
      state.analysis
    );
    const alternatives = test.ok
      ? [test.value ? expression.consequent : expression.alternate]
      : [expression.consequent, expression.alternate];
    for (const alternative of alternatives) {
      mergeValues(
        collectPossibleStaticStringMembers(
          alternative,
          scope,
          name,
          state,
          nextNodes,
          seenBindings,
          atPosition
        )
      );
    }
    return result;
  }
  if (expression.type === 'LogicalExpression') {
    for (const alternative of [expression.left, expression.right]) {
      mergeValues(
        collectPossibleStaticStringMembers(
          alternative,
          scope,
          name,
          state,
          nextNodes,
          seenBindings,
          atPosition
        )
      );
    }
    return result;
  }
  if (expression.type === 'SequenceExpression') {
    const last = expression.expressions.at(-1);
    if (last) {
      mergeValues(
        collectPossibleStaticStringMembers(
          last,
          scope,
          name,
          state,
          nextNodes,
          seenBindings,
          atPosition
        )
      );
    }
    return result;
  }
  if (expression.type === 'AssignmentExpression') {
    mergeValues(
      collectPossibleStaticStringMembers(
        expression.right,
        scope,
        name,
        state,
        nextNodes,
        seenBindings,
        atPosition
      )
    );
    return result;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const sources = resolveVueTemplateContainerSources(
      expression,
      scope,
      state
    );
    if (sources && sources.length > 0) {
      for (const source of sources) {
        mergeValues(
          collectPossibleStaticStringMembers(
            source.node,
            source.scope,
            name,
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      }
      return result;
    }
    const transformedEntries = collectTransformArrayEntries(
      expression,
      scope,
      state,
      new Set(),
      atPosition
    );
    if (transformedEntries) {
      transformedEntries.forEach((entry, index) => {
        if (!entry) return;
        mergeValues(
          collectPossibleStaticStringMembers(
            entry.node,
            entry.scope,
            appendTemplatePath(name, String(index)),
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      });
      return result;
    }
    const callee = unwrapExpression(expression.callee);
    if (
      callee &&
      (callee.type === 'MemberExpression' ||
        callee.type === 'OptionalMemberExpression')
    ) {
      const method = readResolvedMemberProperty(callee, scope, state);
      const receiver = readResolvedMemberPath(callee.object, scope, state);
      const collectReceiver = (): void => {
        mergeValues(
          collectPossibleStaticStringMembers(
            callee.object,
            scope,
            name,
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      };
      if (
        receiver === 'Object' &&
        method === 'assign' &&
        !scope.getBinding('Object')
      ) {
        for (const argument of expression.arguments) {
          if (argument.type === 'ArgumentPlaceholder') continue;
          mergeValues(
            collectPossibleStaticStringMembers(
              argument.type === 'SpreadElement' ? argument.argument : argument,
              scope,
              name,
              state,
              nextNodes,
              seenBindings,
              atPosition
            )
          );
        }
        return result;
      }
      if (
        method &&
        [
          'filter',
          'map',
          'reverse',
          'slice',
          'sort',
          'splice',
          'toReversed',
          'toSorted',
        ].includes(method)
      ) {
        collectReceiver();
      }
      if (method === 'concat') {
        collectReceiver();
        for (const argument of expression.arguments) {
          if (argument.type === 'ArgumentPlaceholder') continue;
          const values = collectPossibleStaticStringMembers(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            name,
            state,
            nextNodes,
            seenBindings,
            atPosition
          );
          for (const [path, strings] of values) {
            const suffix = path === name ? '' : path.slice(name.length + 1);
            const separator = suffix.indexOf('.');
            const remaining = separator === -1 ? '' : suffix.slice(separator);
            const target = `${appendTemplatePath(
              name,
              unknownTemplatePathSegment
            )}${remaining}`;
            mergeValues(new Map([[target, strings]]));
          }
        }
      }
      if (
        receiver === 'Array' &&
        method === 'from' &&
        !scope.getBinding('Array')
      ) {
        const source = expression.arguments[0];
        if (source && source.type !== 'ArgumentPlaceholder') {
          mergeValues(
            collectPossibleStaticStringMembers(
              source.type === 'SpreadElement' ? source.argument : source,
              scope,
              name,
              state,
              nextNodes,
              seenBindings,
              atPosition
            )
          );
        }
      }
    }
    const called = resolveCalledFunction(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (called) {
      withCallParameterSubstitutions(expression, called, scope, state, () => {
        for (const returned of collectFunctionReturnExpressions(
          called.node,
          called.scope,
          state
        )) {
          mergeValues(
            collectPossibleStaticStringMembers(
              returned.node,
              returned.scope,
              name,
              state,
              nextNodes,
              seenBindings,
              atPosition
            )
          );
        }
      });
    } else if (callTargetsUnknownImport(expression.callee, scope)) {
      for (const argument of expression.arguments) {
        if (argument.type === 'ArgumentPlaceholder') continue;
        mergeValues(
          collectPossibleStaticStringMembers(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            name,
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      }
    }
    return result;
  }
  if (expression.type === 'ArrayExpression') {
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? atPosition,
      state
    );
    if (entries) {
      entries.forEach((entry, index) => {
        if (!entry) return;
        for (const [path, values] of collectPossibleStaticStringMembers(
          entry.node,
          entry.scope,
          appendTemplatePath(name, String(index)),
          state,
          nextNodes,
          seenBindings,
          atPosition
        )) {
          result.set(path, values);
        }
      });
    } else {
      expression.elements.forEach((element, index) => {
        if (!element) return;
        mergeValues(
          collectPossibleStaticStringMembers(
            element.type === 'SpreadElement' ? element.argument : element,
            scope,
            element.type === 'SpreadElement'
              ? name
              : appendTemplatePath(name, String(index)),
            state,
            nextNodes,
            seenBindings,
            atPosition
          )
        );
      });
    }
  }
  return result;
}

/** Collects static string leaves introduced through container mutations. */
function bindingMutationPossibleStaticStrings(
  binding: Binding,
  state: ScriptState,
  seenAliases: Set<Binding> = new Set([binding])
): Map<string, Set<string>> {
  const cached = state.mutationPossibleStaticStrings.get(binding);
  if (cached) {
    return new Map(
      [...cached].map(([path, values]) => [path, new Set(values)])
    );
  }
  if (state.mutationPossibleStaticStringsInProgress.has(binding)) {
    return new Map();
  }
  state.mutationPossibleStaticStringsInProgress.add(binding);
  const result = new Map<string, Set<string>>();
  const writePolicy = readBindingContainerWritePolicy(binding, state);
  const blocksWriteAtDepth = (depth: number): boolean =>
    writePolicy === 'readonly-deep' ||
    (writePolicy === 'readonly-shallow' && depth <= 1);
  const appendProperties = (properties: string[]): string =>
    properties.reduce(appendTemplatePath, binding.identifier.name);
  const merge = (values: Map<string, Set<string>>): void => {
    for (const [path, strings] of values) {
      const existing = result.get(path) ?? new Set<string>();
      for (const value of strings) existing.add(value);
      result.set(path, existing);
    }
  };
  const collectValue = (
    value: t.Node,
    scope: Scope,
    properties: string[]
  ): void => {
    merge(
      collectPossibleStaticStringMembers(
        value,
        scope,
        appendProperties(properties),
        state,
        new Set(),
        new Set([binding]),
        Number.POSITIVE_INFINITY
      )
    );
  };

  for (const reference of binding.referencePaths) {
    let current: NodePath<t.Node> = reference;
    const properties: string[] = [];
    while (
      current.parentPath &&
      (current.parentPath.isMemberExpression() ||
        current.parentPath.isOptionalMemberExpression()) &&
      current.parentPath.node.object === current.node
    ) {
      properties.push(
        readResolvedMemberProperty(
          current.parentPath.node,
          current.parentPath.scope,
          state
        ) ?? unknownTemplatePathSegment
      );
      current = current.parentPath;
    }
    const parent = current.parentPath;
    if (parent?.isAssignmentExpression() && parent.node.left === current.node) {
      const target =
        properties[0] === 'value' ? properties.slice(1) : properties;
      if (blocksWriteAtDepth(target.length)) continue;
      collectValue(parent.node.right, parent.scope, target);
      continue;
    }
    if (!parent?.isCallExpression() || parent.node.callee !== current.node) {
      continue;
    }
    const method = properties.at(-1);
    const target = properties
      .slice(0, -1)
      .filter((property, index) => !(index === 0 && property === 'value'));
    if (blocksWriteAtDepth(target.length + 1)) continue;
    const argumentsToCheck =
      method === 'splice'
        ? parent.node.arguments.slice(2)
        : method === 'fill'
          ? parent.node.arguments.slice(0, 1)
          : method === 'push' || method === 'unshift'
            ? parent.node.arguments
            : [];
    for (const argument of argumentsToCheck) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      collectValue(
        argument.type === 'SpreadElement' ? argument.argument : argument,
        parent.scope,
        [...target, unknownTemplatePathSegment]
      );
    }
  }

  for (const reference of binding.referencePaths) {
    const declarator = reference.parentPath;
    if (
      !declarator?.isVariableDeclarator() ||
      declarator.node.init !== reference.node ||
      declarator.node.id.type !== 'Identifier'
    ) {
      continue;
    }
    const alias = declarator.scope.getBinding(declarator.node.id.name);
    if (!alias || seenAliases.has(alias)) continue;
    const aliasValues = bindingMutationPossibleStaticStrings(
      alias,
      state,
      new Set(seenAliases).add(alias)
    );
    for (const [path, values] of aliasValues) {
      const remapped =
        path === alias.identifier.name
          ? binding.identifier.name
          : `${binding.identifier.name}${path.slice(alias.identifier.name.length)}`;
      merge(new Map([[remapped, values]]));
    }
  }
  state.mutationPossibleStaticStrings.set(
    binding,
    new Map([...result].map(([path, values]) => [path, new Set(values)]))
  );
  state.mutationPossibleStaticStringsInProgress.delete(binding);
  return result;
}

/** Collects statically visible string alternatives without executing code. */
function collectPossibleStaticStrings(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): Set<string> {
  const result = new Set<string>();
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return result;
  const nextSeen = new Set(seen).add(expression);
  if (
    expression.type === 'Identifier' &&
    state.parameterSubstitutions.length === 0
  ) {
    const binding = scope.getBinding(expression.name);
    if (binding) {
      const cached = state.possibleStaticStrings.get(binding);
      if (cached) return new Set(cached);
      if (state.possibleStaticStringsInProgress.has(binding)) return result;
      state.possibleStaticStringsInProgress.add(binding);
      try {
        const source = getBindingSource(binding);
        if (source && binding.constant) {
          for (const value of collectPossibleStaticStrings(
            source.expression.node,
            source.expression.scope,
            state,
            nextSeen
          )) {
            result.add(value);
          }
        } else {
          const exposed = state.analysis.possibleStaticStrings.get(
            expression.name
          );
          if (exposed) {
            for (const value of exposed) result.add(value);
          }
        }
        state.possibleStaticStrings.set(binding, new Set(result));
        return result;
      } finally {
        state.possibleStaticStringsInProgress.delete(binding);
      }
    }
  }
  const staticValue = readStaticFromScope(
    expression,
    scope,
    new Set(),
    expression.end ?? Number.POSITIVE_INFINITY,
    state.analysis
  );
  if (staticValue.ok) {
    if (typeof staticValue.value === 'string') result.add(staticValue.value);
    return result;
  }
  const add = (values: Set<string>) => {
    for (const value of values) result.add(value);
  };
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const substitution = binding
      ? readParameterSubstitution(binding, state)
      : undefined;
    if (substitution) {
      return collectPossibleStaticStrings(
        substitution.node,
        substitution.scope,
        state,
        nextSeen
      );
    }
    const source = binding ? getBindingSource(binding) : undefined;
    if (source && binding?.constant) {
      add(
        collectPossibleStaticStrings(
          source.expression.node,
          source.expression.scope,
          state,
          nextSeen
        )
      );
    } else {
      const values = state.analysis.possibleStaticStrings.get(expression.name);
      if (values) add(values);
    }
    return result;
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const path = readExposedMemberPath(expression, scope, state);
    const exposed = path
      ? state.analysis.possibleStaticStrings.get(path)
      : undefined;
    if (exposed) add(exposed);
    const property = readResolvedMemberProperty(expression, scope, state);
    const selected = property
      ? selectStaticMemberExpression(
          expression.object,
          property,
          scope,
          state,
          expression.end ?? Number.POSITIVE_INFINITY,
          new Set()
        )
      : undefined;
    if (selected) {
      add(
        collectPossibleStaticStrings(
          selected.node,
          selected.scope,
          state,
          nextSeen
        )
      );
    } else if (!property) {
      for (const values of collectPossibleStaticStringMembers(
        expression.object,
        scope,
        '',
        state,
        new Set(),
        new Set(),
        expression.end ?? Number.POSITIVE_INFINITY
      ).values()) {
        add(values);
      }
    }
    return result;
  }
  if (expression.type === 'ConditionalExpression') {
    const test = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (test.ok) {
      return collectPossibleStaticStrings(
        test.value ? expression.consequent : expression.alternate,
        scope,
        state,
        nextSeen
      );
    }
    add(
      collectPossibleStaticStrings(
        expression.consequent,
        scope,
        state,
        nextSeen
      )
    );
    add(
      collectPossibleStaticStrings(expression.alternate, scope, state, nextSeen)
    );
    return result;
  }
  if (expression.type === 'LogicalExpression') {
    add(collectPossibleStaticStrings(expression.left, scope, state, nextSeen));
    add(collectPossibleStaticStrings(expression.right, scope, state, nextSeen));
    return result;
  }
  if (expression.type === 'SequenceExpression') {
    return collectPossibleStaticStrings(
      expression.expressions.at(-1),
      scope,
      state,
      nextSeen
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return collectPossibleStaticStrings(
      expression.right,
      scope,
      state,
      nextSeen
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return collectPossibleStaticStrings(
      expression.argument,
      scope,
      state,
      nextSeen
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const wrapper = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      new Set()
    );
    const first = expression.arguments[0];
    if (
      wrapper?.type === 'vue-wrapper' &&
      first &&
      first.type !== 'ArgumentPlaceholder' &&
      first.type !== 'SpreadElement'
    ) {
      if (wrapper.kind === 'ref') {
        return collectPossibleStaticStrings(first, scope, state, nextSeen);
      }
      const getter = resolveComputedGetter(first, scope, state);
      return getter
        ? collectFunctionPossibleStaticStrings(getter.node, getter.scope, state)
        : result;
    }
    const called = resolveCalledFunction(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (called) {
      withCallParameterSubstitutions(expression, called, scope, state, () => {
        for (const returned of collectFunctionReturnExpressions(
          called.node,
          called.scope,
          state
        )) {
          add(
            collectPossibleStaticStrings(
              returned.node,
              returned.scope,
              state,
              nextSeen
            )
          );
        }
      });
    }
  }
  return result;
}

/** Collects all statically visible strings returned by one local function. */
function collectFunctionPossibleStaticStrings(
  fn: t.Function,
  scope: Scope,
  state: ScriptState
): Set<string> {
  const functionScope = state.scopes.get(fn) ?? scope;
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return collectPossibleStaticStrings(
      fn.body,
      functionScope,
      state,
      new Set()
    );
  }
  const result = new Set<string>();
  const functionPath = state.paths.get(fn);
  if (!functionPath || fn.body.type !== 'BlockStatement') return result;
  functionPath.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(path) {
      for (const value of collectPossibleStaticStrings(
        path.node.argument,
        path.scope,
        state,
        new Set()
      )) {
        result.add(value);
      }
    },
  });
  return result;
}

function collectStaticMemberValues(
  node: t.Node,
  scope: Scope,
  name: string,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>,
  atPosition: number
): Map<string, StaticPrimitive> {
  const result = new Map<string, StaticPrimitive>();
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return result;
  const staticValue = readStaticFromScope(
    expression,
    scope,
    new Set(),
    atPosition,
    state.analysis
  );
  if (staticValue.ok) {
    result.set(name, staticValue.value);
    return result;
  }
  const nextNodes = new Set(seenNodes).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (
      !binding ||
      seenBindings.has(binding) ||
      !isSafelyReadContainerBinding(
        binding,
        expression,
        atPosition,
        false,
        state
      )
    ) {
      return result;
    }
    const source = getBindingSource(binding);
    return source?.pattern.type === 'Identifier'
      ? collectStaticMemberValues(
          source.expression.node,
          source.expression.scope,
          name,
          state,
          nextNodes,
          new Set(seenBindings).add(binding),
          atPosition
        )
      : result;
  }
  if (expression.type === 'ObjectExpression') {
    const entries = collectObjectEntries(
      expression,
      scope,
      new Set(seenNodes),
      atPosition,
      state
    );
    for (const [key, entry] of entries.entries) {
      for (const [path, value] of collectStaticMemberValues(
        entry.node,
        entry.scope,
        appendTemplatePath(name, key),
        state,
        nextNodes,
        seenBindings,
        atPosition
      )) {
        result.set(path, value);
      }
    }
    return result;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const sources = resolveVueTemplateContainerSources(
      expression,
      scope,
      state
    );
    if (!sources || sources.length === 0) return result;
    const sourceValues = sources.map((source) =>
      collectStaticMemberValues(
        source.node,
        source.scope,
        name,
        state,
        nextNodes,
        seenBindings,
        atPosition
      )
    );
    for (const [path, value] of sourceValues[0] ?? []) {
      if (
        sourceValues.every(
          (values) => values.has(path) && Object.is(values.get(path), value)
        )
      ) {
        result.set(path, value);
      }
    }
    return result;
  }
  if (expression.type === 'ArrayExpression') {
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? atPosition,
      state
    );
    entries?.forEach((entry, index) => {
      if (!entry) return;
      for (const [path, value] of collectStaticMemberValues(
        entry.node,
        entry.scope,
        appendTemplatePath(name, String(index)),
        state,
        nextNodes,
        seenBindings,
        atPosition
      )) {
        result.set(path, value);
      }
    });
  }
  return result;
}

/** Flattens statically known container paths without executing user code. */
function collectContainerKinds(
  node: t.Node,
  scope: Scope,
  name: string,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>,
  atPosition: number,
  arrayLengths?: Map<string, number>
): Map<string, TemplateContainerKind> {
  if (state.analysis.stats) state.analysis.stats.containerKindVisits += 1;
  const result = new Map<string, TemplateContainerKind>();
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return result;
  // Exact GT/Vue identities and string functions are scalar values. Direct
  // aliases can legitimately be inserted into a mutable container, which
  // makes the conservative container-use cache ineligible; resolving the
  // already memoized scalar identity avoids re-walking the full alias prefix.
  if (resolveKnownExpression(expression, scope, state, new Set())) {
    return result;
  }
  const nextNodes = new Set(seenNodes).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const readonlyUses = binding
      ? bindingHasOnlyReadonlyContainerUses(binding, state, new Set())
      : false;
    if (
      !binding ||
      seenBindings.has(binding) ||
      !isSafelyReadContainerBinding(
        binding,
        expression,
        atPosition,
        false,
        state
      )
    ) {
      return result;
    }
    const source = getBindingSource(binding);
    if (source?.pattern.type !== 'Identifier') return result;
    const cacheable = readonlyUses && state.parameterSubstitutions.length === 0;
    const applySnapshot = (snapshot: {
      arrayLengths: Map<string, number>;
      kinds: Map<string, TemplateContainerKind>;
    }): void => {
      const root = binding.identifier.name;
      for (const [path, kind] of snapshot.kinds) {
        result.set(
          path === root ? name : `${name}${path.slice(root.length)}`,
          kind
        );
      }
      if (arrayLengths) {
        for (const [path, length] of snapshot.arrayLengths) {
          arrayLengths.set(
            path === root ? name : `${name}${path.slice(root.length)}`,
            length
          );
        }
      }
    };
    const cached = cacheable
      ? state.containerKindSnapshots.get(binding)
      : undefined;
    if (cached) {
      applySnapshot(cached);
      return result;
    }
    if (cacheable && state.containerKindSnapshotsInProgress.has(binding)) {
      return result;
    }
    if (cacheable) state.containerKindSnapshotsInProgress.add(binding);
    try {
      const canonicalLengths = new Map<string, number>();
      const kinds = collectContainerKinds(
        source.expression.node,
        source.expression.scope,
        cacheable ? binding.identifier.name : name,
        state,
        nextNodes,
        new Set(seenBindings).add(binding),
        atPosition,
        cacheable ? canonicalLengths : arrayLengths
      );
      if (!cacheable) return kinds;
      const snapshot = {
        arrayLengths: canonicalLengths,
        kinds,
      };
      state.containerKindSnapshots.set(binding, snapshot);
      applySnapshot(snapshot);
      return result;
    } finally {
      if (cacheable) state.containerKindSnapshotsInProgress.delete(binding);
    }
  }
  if (expression.type === 'ObjectExpression') {
    result.set(name, 'object');
    const entries = collectObjectEntries(
      expression,
      scope,
      new Set(seenNodes),
      atPosition,
      state
    );
    for (const [key, entry] of entries.entries) {
      for (const [path, kind] of collectContainerKinds(
        entry.node,
        entry.scope,
        appendTemplatePath(name, key),
        state,
        nextNodes,
        seenBindings,
        atPosition,
        arrayLengths
      )) {
        result.set(path, kind);
      }
    }
    return result;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const transformedEntries = collectTransformArrayEntries(
      expression,
      scope,
      state,
      new Set(),
      atPosition
    );
    if (transformedEntries) {
      result.set(name, 'array');
      arrayLengths?.set(name, transformedEntries.length);
      transformedEntries.forEach((entry, index) => {
        if (!entry) return;
        for (const [path, kind] of collectContainerKinds(
          entry.node,
          entry.scope,
          appendTemplatePath(name, String(index)),
          state,
          nextNodes,
          seenBindings,
          atPosition,
          arrayLengths
        )) {
          result.set(path, kind);
        }
      });
      return result;
    }
    const sources = resolveVueTemplateContainerSources(
      expression,
      scope,
      state
    );
    if (!sources || sources.length === 0) return result;
    const sourceLengths = sources.map(() => new Map<string, number>());
    const sourceKinds = sources.map((source, index) =>
      collectContainerKinds(
        source.node,
        source.scope,
        name,
        state,
        nextNodes,
        seenBindings,
        atPosition,
        sourceLengths[index]
      )
    );
    for (const [path, kind] of sourceKinds[0] ?? []) {
      if (sourceKinds.every((kinds) => kinds.get(path) === kind)) {
        result.set(path, kind);
      }
    }
    for (const [path, length] of sourceLengths[0] ?? []) {
      if (sourceLengths.every((lengths) => lengths.get(path) === length)) {
        arrayLengths?.set(path, length);
      }
    }
    return result;
  }
  if (expression.type === 'ArrayExpression') {
    result.set(name, 'array');
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? atPosition,
      state
    );
    if (!entries) return result;
    arrayLengths?.set(name, entries.length);
    entries.forEach((entry, index) => {
      if (!entry) return;
      for (const [path, kind] of collectContainerKinds(
        entry.node,
        entry.scope,
        appendTemplatePath(name, String(index)),
        state,
        nextNodes,
        seenBindings,
        atPosition,
        arrayLengths
      )) {
        result.set(path, kind);
      }
    });
  }
  return result;
}

/** Records values assigned through a statically named member path. */
function collectMemberWriteCandidates(
  localName: string,
  binding: Binding,
  state: ScriptState
): ComponentMemberCandidate[] {
  const candidates: ComponentMemberCandidate[] = [];
  for (const reference of binding.referencePaths) {
    let current: NodePath<t.Node> = reference;
    const properties: string[] = [];
    let dynamic = false;
    while (
      current.parentPath &&
      (current.parentPath.isMemberExpression() ||
        current.parentPath.isOptionalMemberExpression()) &&
      current.parentPath.node.object === current.node
    ) {
      const property = readResolvedMemberProperty(
        current.parentPath.node,
        current.parentPath.scope,
        state
      );
      if (property === undefined) dynamic = true;
      else properties.push(property);
      current = current.parentPath;
    }
    const assignment = current.parentPath;
    if (
      !assignment?.isAssignmentExpression() ||
      assignment.node.left !== current.node
    ) {
      continue;
    }
    const name =
      !dynamic && properties.length > 0
        ? properties.reduce(appendTemplatePath, localName)
        : localName;
    for (const value of collectPossibleTemplateValues(
      assignment.node.right,
      assignment.scope,
      state,
      new Set()
    )) {
      candidates.push({ certain: false, name, value });
    }
  }
  return candidates;
}

/** Collects known GT-relevant leaves without claiming one definite result. */
function collectPossibleTemplateValues(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): Array<TemplateKnownValue> {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return [];
  const nextSeen = new Set(seen).add(expression);
  const known = resolveKnownExpression(expression, scope, state, new Set());
  if (
    known?.type === 'component' ||
    known?.type === 'string' ||
    known?.type === 'vue-builtin'
  ) {
    return [known];
  }
  if (expression.type === 'ConditionalExpression') {
    return [
      ...collectPossibleTemplateValues(
        expression.consequent,
        scope,
        state,
        nextSeen
      ),
      ...collectPossibleTemplateValues(
        expression.alternate,
        scope,
        state,
        nextSeen
      ),
    ];
  }
  if (expression.type === 'LogicalExpression') {
    return [
      ...collectPossibleTemplateValues(expression.left, scope, state, nextSeen),
      ...collectPossibleTemplateValues(
        expression.right,
        scope,
        state,
        nextSeen
      ),
    ];
  }
  if (expression.type === 'SequenceExpression') {
    return collectPossibleTemplateValues(
      expression.expressions.at(-1),
      scope,
      state,
      nextSeen
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return collectPossibleTemplateValues(
      expression.right,
      scope,
      state,
      nextSeen
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return collectPossibleTemplateValues(
      expression.argument,
      scope,
      state,
      nextSeen
    );
  }
  return [];
}

/** Collects GT-relevant values returned by one getter or computed source. */
function collectFunctionTemplateValues(
  fn: t.Function,
  scope: Scope,
  state: ScriptState
): Array<TemplateKnownValue> {
  const functionScope = state.scopes.get(fn) ?? scope;
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return collectPossibleTemplateValues(
      fn.body,
      functionScope,
      state,
      new Set()
    );
  }
  const functionPath = state.paths.get(fn);
  if (!functionPath || fn.body.type !== 'BlockStatement') return [];
  const values: TemplateKnownValue[] = [];
  functionPath.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(path) {
      values.push(
        ...collectPossibleTemplateValues(
          path.node.argument,
          path.scope,
          state,
          new Set()
        )
      );
    },
  });
  return values;
}

function collectComponentMemberCandidates(
  node: t.Node,
  scope: Scope,
  name: string,
  state: ScriptState,
  certain: boolean,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>,
  atPosition = Number.POSITIVE_INFINITY
): ComponentMemberCandidate[] {
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return [];
  const nextNodes = new Set(seenNodes).add(expression);
  const value = resolveKnownExpression(expression, scope, state, new Set());
  if (
    value?.type === 'component' ||
    value?.type === 'string' ||
    value?.type === 'vue-builtin'
  ) {
    return [{ certain, name, value }];
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding || seenBindings.has(binding)) return [];
    const source = getBindingSource(binding);
    if (!source || source.pattern.type !== 'Identifier') return [];
    return collectComponentMemberCandidates(
      source.expression.node,
      source.expression.scope,
      name,
      state,
      certain &&
        isSafelyReadContainerBinding(
          binding,
          expression,
          atPosition,
          false,
          state
        ),
      nextNodes,
      new Set(seenBindings).add(binding),
      atPosition
    );
  }
  if (expression.type === 'ObjectExpression') {
    const candidates = new Map<string, ComponentMemberCandidate>();
    for (const property of expression.properties) {
      if (property.type === 'SpreadElement') {
        const spreadIsKnown = componentContainerShapeIsKnown(
          property.argument,
          scope,
          state,
          new Set(),
          property.argument.end ?? atPosition
        );
        if (!spreadIsKnown) {
          for (const [candidateName, candidate] of candidates) {
            candidates.set(candidateName, { ...candidate, certain: false });
          }
        }
        for (const candidate of collectComponentMemberCandidates(
          property.argument,
          scope,
          name,
          state,
          certain && spreadIsKnown,
          nextNodes,
          seenBindings,
          property.argument.end ?? atPosition
        )) {
          candidates.set(candidate.name, candidate);
        }
        continue;
      }
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) {
        for (const [candidateName, candidate] of candidates) {
          candidates.set(candidateName, { ...candidate, certain: false });
        }
        continue;
      }
      const memberName = appendTemplatePath(name, key);
      for (const candidateName of candidates.keys()) {
        if (
          candidateName === memberName ||
          candidateName.startsWith(`${memberName}.`)
        ) {
          candidates.delete(candidateName);
        }
      }
      if (property.type === 'ObjectMethod' && property.kind === 'get') {
        let foundStringFunction = false;
        for (const getterValue of collectFunctionTemplateValues(
          property,
          scope,
          state
        )) {
          if (getterValue.type === 'string') foundStringFunction = true;
          candidates.set(memberName, {
            certain: false,
            name: memberName,
            value: getterValue,
          });
        }
        if (
          !foundStringFunction &&
          functionMayReturnStringFunction(property, scope, state, new Set())
        ) {
          candidates.set(memberName, {
            certain: false,
            name: memberName,
            value: { type: 'string', kind: 'msg' },
          });
        }
        continue;
      }
      if (property.type !== 'ObjectProperty') continue;
      for (const candidate of collectComponentMemberCandidates(
        property.value,
        scope,
        memberName,
        state,
        certain,
        nextNodes,
        seenBindings,
        atPosition
      )) {
        candidates.set(candidate.name, candidate);
      }
    }
    return [...candidates.values()];
  }
  if (expression.type === 'ArrayExpression') {
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (entries) {
      return entries.flatMap((entry, index) =>
        entry
          ? collectComponentMemberCandidates(
              entry.node,
              entry.scope,
              appendTemplatePath(name, String(index)),
              state,
              certain,
              nextNodes,
              seenBindings,
              atPosition
            )
          : []
      );
    }
    const firstSpread = expression.elements.findIndex(
      (element) => element?.type === 'SpreadElement'
    );
    return expression.elements.flatMap((element, index) =>
      element &&
      element.type !== 'SpreadElement' &&
      (firstSpread === -1 || index < firstSpread)
        ? collectComponentMemberCandidates(
            element,
            scope,
            appendTemplatePath(name, String(index)),
            state,
            certain,
            nextNodes,
            seenBindings,
            atPosition
          )
        : []
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const transformedEntries = collectTransformArrayEntries(
      expression,
      scope,
      state,
      new Set(),
      atPosition
    );
    if (transformedEntries) {
      return transformedEntries.flatMap((entry, index) =>
        entry
          ? collectComponentMemberCandidates(
              entry.node,
              entry.scope,
              appendTemplatePath(name, String(index)),
              state,
              certain,
              nextNodes,
              seenBindings,
              atPosition
            )
          : []
      );
    }
    const containerSources = resolveVueTemplateContainerSources(
      expression,
      scope,
      state
    );
    if (containerSources) {
      return containerSources.flatMap((source) =>
        collectComponentMemberCandidates(
          source.node,
          source.scope,
          name,
          state,
          certain && containerSources.length === 1,
          nextNodes,
          seenBindings,
          atPosition
        )
      );
    }
    if (
      readResolvedMemberPath(expression.callee, scope, state) ===
      'Object.entries'
    ) {
      return [];
    }
    return expression.arguments.flatMap((argument) =>
      argument.type === 'ArgumentPlaceholder'
        ? []
        : collectComponentMemberCandidates(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            name,
            state,
            false,
            nextNodes,
            seenBindings,
            atPosition
          )
    );
  }
  return [];
}

/** Returns whether every key and spread position in a container is known. */
function componentContainerShapeIsKnown(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>,
  atPosition: number
): boolean {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return false;
  const nextSeen = new Set(seen).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (
      !binding ||
      !isSafelyReadContainerBinding(
        binding,
        expression,
        atPosition,
        false,
        state
      )
    ) {
      return false;
    }
    const source = getBindingSource(binding);
    return Boolean(
      source?.pattern.type === 'Identifier' &&
      componentContainerShapeIsKnown(
        source.expression.node,
        source.expression.scope,
        state,
        nextSeen,
        atPosition
      )
    );
  }
  if (expression.type === 'ObjectExpression') {
    return expression.properties.every((property) =>
      property.type === 'SpreadElement'
        ? componentContainerShapeIsKnown(
            property.argument,
            scope,
            state,
            nextSeen,
            property.argument.end ?? atPosition
          )
        : readResolvedPropertyKey(property, scope, state) !== undefined
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    return (
      collectTransformArrayEntries(
        expression,
        scope,
        state,
        new Set(seen),
        atPosition
      ) !== undefined
    );
  }
  return (
    expression.type === 'ArrayExpression' &&
    collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    ) !== undefined
  );
}

/** Resolves a mutable string-call binding at the call's source position. */
function resolveKnownCallTargetAtPosition(
  node: t.Node,
  scope: Scope,
  atPosition: number,
  state: ScriptState
): {
  definitelyOrdinary: boolean;
  possibleStringFunction?: boolean;
  value: KnownValue | undefined;
} {
  const expression = unwrapExpression(node);
  const replayed = evaluateReplayAtPosition(node, scope, atPosition, state);
  if (replayed?.type === 'leaf') {
    if (isReplayGetterStringLeaf(replayed)) {
      return {
        definitelyOrdinary: false,
        possibleStringFunction: true,
        value: undefined,
      };
    }
    if (replayed.knownValue?.type === 'string') {
      return { definitelyOrdinary: false, value: replayed.knownValue };
    }
    if (
      replayed.hasGT === false ||
      replayed.knownValue?.type === 'component' ||
      replayed.knownValue?.type === 'vue-builtin'
    ) {
      return { definitelyOrdinary: true, value: undefined };
    }
  }
  if (replayed?.type === 'unsafe') {
    return { definitelyOrdinary: false, value: undefined };
  }
  if (expression?.type !== 'Identifier') {
    return {
      definitelyOrdinary: false,
      value: resolveKnownExpression(node, scope, state, new Set()),
    };
  }
  const binding = scope.getBinding(expression.name);
  if (!binding || binding.constantViolations.length === 0) {
    return {
      definitelyOrdinary: false,
      value: resolveKnownExpression(expression, scope, state, new Set()),
    };
  }
  const candidates = readPossibleBindingValuesAtPosition(
    binding,
    atPosition,
    state
  );
  if (candidates.length !== 1) {
    return { definitelyOrdinary: false, value: undefined };
  }
  const candidate = candidates[0]!;
  const value = resolveKnownExpression(
    candidate.node,
    candidate.scope,
    state,
    new Set([binding])
  );
  if (value) return { definitelyOrdinary: value.type !== 'string', value };
  const materialized = unwrapExpression(candidate.node);
  const definitelyOrdinary = Boolean(
    materialized?.type === 'Identifier' &&
    !candidate.scope.getBinding(materialized.name) &&
    ORDINARY_GLOBAL_VALUES.has(materialized.name)
  );
  return { definitelyOrdinary, value: undefined };
}

/** Resolves a call using only lexical identities, ignoring active callbacks. */
function resolveKnownCallTargetWithoutParameterSubstitutions(
  node: t.Node,
  scope: Scope,
  atPosition: number,
  state: ScriptState
): ReturnType<typeof resolveKnownCallTargetAtPosition> {
  if (state.parameterSubstitutions.length === 0) {
    return resolveKnownCallTargetAtPosition(node, scope, atPosition, state);
  }
  const substitutions = state.parameterSubstitutions;
  state.parameterSubstitutions = [];
  try {
    return resolveKnownCallTargetAtPosition(node, scope, atPosition, state);
  } finally {
    state.parameterSubstitutions = substitutions;
  }
}

function resolveKnownExpression(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  if (state.analysis.stats) state.analysis.stats.knownExpressionVisits += 1;
  const expression = unwrapExpression(node);
  if (!expression) return undefined;

  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const substitution = binding
      ? readParameterSubstitution(binding, state)
      : undefined;
    if (substitution) {
      return resolveKnownExpression(
        substitution.node,
        substitution.scope,
        state,
        seen
      );
    }
    const value = binding
      ? resolveKnownBinding(binding, state, seen)
      : state.analysis.values.get(expression.name);
    if (
      binding &&
      value?.type === 'namespace' &&
      value.mutable &&
      (state.unsafeMutableNamespaceSources.has(value.source) ||
        !isSafeMutableNamespaceBinding(binding))
    ) {
      return undefined;
    }
    return value;
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const memberPath = readExposedMemberPath(expression, scope, state);
    const exposed = memberPath
      ? state.analysis.values.get(memberPath)
      : undefined;
    if (exposed) return exposed;
    const object = resolveKnownExpression(
      expression.object,
      scope,
      state,
      seen
    );
    const property = readResolvedMemberProperty(expression, scope, state);
    const wrappedValue =
      property === 'value'
        ? resolveVueWrappedMemberValue(expression.object, scope, state)
        : undefined;
    if (wrappedValue) return wrappedValue;
    if (object?.type === 'namespace' && property) {
      return knownExport(object.source, property);
    }
    if (object?.type === 'local-namespace' && property) {
      const resolution = state.analysis.localModules?.resolveExport(
        object.modulePath,
        property
      );
      return resolution?.status === 'resolved'
        ? materializeLocalExport(resolution.target, state).value
        : undefined;
    }
    const selected = property
      ? selectStaticMemberExpression(
          expression.object,
          property,
          scope,
          state,
          expression.end ?? Number.POSITIVE_INFINITY,
          new Set()
        )
      : undefined;
    if (selected) {
      return resolveKnownExpression(selected.node, selected.scope, state, seen);
    }
    return undefined;
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const namespace = readRequireNamespace(expression, scope);
    if (
      namespace &&
      !state.unsafeMutableNamespaceSources.has(namespace.source)
    ) {
      return namespace;
    }
    const callee = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      seen
    );
    if (callee?.type === 'hook') {
      return { type: 'string', kind: callee.kind };
    }
    const argument = expression.arguments[0];
    return callee?.type === 'identity' &&
      expression.arguments.length === 1 &&
      argument &&
      argument.type !== 'SpreadElement' &&
      argument.type !== 'ArgumentPlaceholder'
      ? resolveKnownExpression(argument, scope, state, new Set(seen))
      : undefined;
  }
  if (expression.type === 'LogicalExpression') {
    const left = resolveKnownExpression(
      expression.left,
      scope,
      state,
      new Set(seen)
    );
    if (left) {
      return expression.operator === '&&'
        ? resolveKnownExpression(expression.right, scope, state, new Set(seen))
        : left;
    }
    const staticLeft = readStaticFromScope(
      expression.left,
      scope,
      new Set(),
      expression.left.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (!staticLeft.ok) return undefined;
    const selectsRight =
      expression.operator === '??'
        ? staticLeft.value == null
        : expression.operator === '||'
          ? !staticLeft.value
          : Boolean(staticLeft.value);
    return selectsRight
      ? resolveKnownExpression(expression.right, scope, state, new Set(seen))
      : undefined;
  }
  if (expression.type === 'ConditionalExpression') {
    const condition = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (condition.ok) {
      return resolveKnownExpression(
        condition.value ? expression.consequent : expression.alternate,
        scope,
        state,
        new Set(seen)
      );
    }
    const consequent = resolveKnownExpression(
      expression.consequent,
      scope,
      state,
      new Set(seen)
    );
    const alternate = resolveKnownExpression(
      expression.alternate,
      scope,
      state,
      new Set(seen)
    );
    return consequent &&
      alternate &&
      knownValueKey(consequent) === knownValueKey(alternate)
      ? consequent
      : undefined;
  }
  if (expression.type === 'SequenceExpression') {
    return resolveKnownExpression(
      expression.expressions.at(-1),
      scope,
      state,
      new Set(seen)
    );
  }
  return undefined;
}

/** Resolves a safely read `.value` from a local Vue ref or computed ref. */
function resolveVueWrappedMemberValue(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): KnownValue | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      return state.analysis.templateValues.get(expression.name);
    }
    if (
      !isSafelyReadContainerBinding(
        binding,
        expression,
        expression.end ?? Number.POSITIVE_INFINITY,
        true,
        state
      )
    ) {
      return undefined;
    }
    const source = getBindingSource(binding);
    return source?.pattern.type === 'Identifier'
      ? resolveTemplateKnownExpression(
          source.expression.node,
          source.expression.scope,
          state
        )
      : undefined;
  }
  return resolveTemplateKnownExpression(expression, scope, state);
}

/** Reads a statically keyed member path for an exposed cross-block value. */
function readResolvedMemberPath(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): string | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (expression.type === 'Identifier') return expression.name;
  if (
    expression.type !== 'MemberExpression' &&
    expression.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  const object = readResolvedMemberPath(expression.object, scope, state);
  const property = readResolvedMemberProperty(expression, scope, state);
  return object && property !== undefined
    ? appendTemplatePath(object, property)
    : undefined;
}

/** Reads a cross-block member path only when its root is not locally bound. */
function readExposedMemberPath(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): string | undefined {
  const path = readResolvedMemberPath(node, scope, state);
  const root = path?.split('.', 1)[0];
  return root && !scope.getBinding(root) ? path : undefined;
}

/** Maps a nested destructuring target to its exact cross-block member path. */
function readPatternExposedMemberPath(
  pattern: t.Node,
  targetName: string,
  basePath: string,
  scope: Scope,
  state: ScriptState
): string | undefined {
  if (pattern.type === 'Identifier') {
    return pattern.name === targetName ? basePath : undefined;
  }
  if (pattern.type === 'AssignmentPattern') {
    return readPatternExposedMemberPath(
      pattern.left,
      targetName,
      basePath,
      scope,
      state
    );
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (
        property.type !== 'ObjectProperty' ||
        !patternContains(property.value, targetName)
      ) {
        continue;
      }
      const key = readResolvedPropertyKey(property, scope, state);
      return key
        ? readPatternExposedMemberPath(
            property.value,
            targetName,
            appendTemplatePath(basePath, key),
            scope,
            state
          )
        : undefined;
    }
  }
  if (pattern.type === 'ArrayPattern') {
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const element = pattern.elements[index];
      if (!element || !patternContains(element, targetName)) continue;
      return readPatternExposedMemberPath(
        element,
        targetName,
        appendTemplatePath(basePath, String(index)),
        scope,
        state
      );
    }
  }
  return undefined;
}

/** Selects one nested literal member without evaluating application code. */
function selectStaticMemberExpression(
  node: t.Node,
  key: string,
  scope: Scope,
  state: ScriptState,
  atPosition: number,
  seen: Set<t.Node>
): ScopedExpression | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  const nextSeen = new Set(seen).add(expression);
  if (expression.type === 'ThisExpression') {
    const substitution = readThisSubstitution(state);
    return substitution
      ? selectStaticMemberExpression(
          substitution.node,
          key,
          substitution.scope,
          state,
          atPosition,
          nextSeen
        )
      : undefined;
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    const substitution = binding
      ? readParameterSubstitution(binding, state)
      : undefined;
    if (substitution) {
      return selectStaticMemberExpression(
        substitution.node,
        key,
        substitution.scope,
        state,
        atPosition,
        nextSeen
      );
    }
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const parentKey = readResolvedMemberProperty(expression, scope, state);
    const parent = parentKey
      ? selectStaticMemberExpression(
          expression.object,
          parentKey,
          scope,
          state,
          atPosition,
          nextSeen
        )
      : undefined;
    return parent
      ? selectStaticMemberExpression(
          parent.node,
          key,
          parent.scope,
          state,
          atPosition,
          nextSeen
        )
      : undefined;
  }
  const index = key.match(/^(0|[1-9]\d*)$/) ? Number(key) : undefined;
  if (index !== undefined) {
    const entry = readArrayEntry(
      expression,
      index,
      scope,
      new Set(),
      atPosition,
      state
    );
    return entry.status === 'known' ? entry.expression : undefined;
  }
  const entry = readObjectEntry(
    expression,
    key,
    scope,
    new Set(),
    atPosition,
    state
  );
  return entry.status === 'known' ? entry.expression : undefined;
}

function resolveKnownBinding(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding>
): KnownValue | undefined {
  const cacheable = state.parameterSubstitutions.length === 0;
  const mutableSource = state.mutableImportSources.get(binding);
  if (mutableSource && state.unsafeMutableNamespaceSources.has(mutableSource)) {
    if (cacheable) state.resolvedBindings.add(binding);
    return undefined;
  }
  const existing = state.bindings.get(binding);
  if (existing) return existing;
  if (cacheable && state.resolvedBindings.has(binding)) return undefined;
  if (seen.has(binding)) return undefined;
  seen.add(binding);

  const source = getBindingSource(binding);
  const value = source
    ? resolvePatternKnownValue(
        source.pattern,
        source.expression.node,
        binding.identifier.name,
        source.expression.scope,
        state,
        seen,
        source.expression.node.end ?? Number.POSITIVE_INFINITY
      )
    : undefined;
  if (value) state.bindings.set(binding, value);
  if (cacheable) state.resolvedBindings.add(binding);
  return value;
}

/** Resolves values that Vue automatically unwraps at the template boundary. */
function resolveTemplateKnownBinding(
  binding: Binding,
  state: ScriptState
): KnownValue | undefined {
  const direct = resolveKnownBinding(binding, state, new Set());
  if (direct) return direct;
  const source = getBindingSource(binding);
  if (!source || source.pattern.type !== 'Identifier') return undefined;
  const value = resolveTemplateKnownExpression(
    source.expression.node,
    source.expression.scope,
    state
  );
  if (
    !value ||
    !isVueWrapperExpression(
      source.expression.node,
      source.expression.scope,
      state
    )
  ) {
    return value;
  }
  // Vue does not render a component stored in a ref/computed wrapper as an
  // exact template component alias. Keep these aliases opaque so extraction
  // fails closed instead of publishing a component shape that differs from
  // runtime behavior.
  if (value.type === 'component' || value.type === 'vue-builtin') {
    return undefined;
  }
  return isSafelyReadContainerBinding(
    binding,
    binding.identifier,
    Number.POSITIVE_INFINITY,
    true,
    state
  )
    ? value
    : undefined;
}

/** Returns whether an expression creates a Vue ref or computed ref. */
function isVueWrapperExpression(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): boolean {
  const expression = unwrapExpression(node);
  if (
    !expression ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression')
  ) {
    return false;
  }
  return (
    resolveKnownExpression(expression.callee, scope, state, new Set())?.type ===
    'vue-wrapper'
  );
}

/** Models only Vue's top-level ref, shallowRef, and computed unwrapping. */
function resolveTemplateKnownExpression(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState
): KnownValue | undefined {
  const direct = resolveKnownExpression(node, scope, state, new Set());
  if (direct) return direct;
  const expression = unwrapExpression(node);
  if (
    !expression ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression')
  ) {
    return undefined;
  }
  const wrapper = resolveKnownExpression(
    expression.callee,
    scope,
    state,
    new Set()
  );
  if (wrapper?.type !== 'vue-wrapper') return undefined;
  const first = expression.arguments[0];
  if (
    !first ||
    first.type === 'ArgumentPlaceholder' ||
    first.type === 'SpreadElement'
  ) {
    return undefined;
  }
  if (wrapper.kind === 'ref') {
    return resolveKnownExpression(first, scope, state, new Set());
  }
  const getter = resolveComputedGetter(first, scope, state);
  return getter
    ? resolveFunctionTemplateValue(getter.node, getter.scope, state)
    : undefined;
}

/** Resolves the function Vue invokes for one computed ref. */
function resolveComputedGetter(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): (ScopedExpression & { node: t.Function }) | undefined {
  const direct = resolveCalledFunction(node, scope, state, new Set());
  if (direct) return direct;
  const object = resolveObjectExpression(node, scope, new Set());
  if (!object) return undefined;
  const entry = readObjectEntry(
    object.node,
    'get',
    object.scope,
    new Set(),
    node.end ?? Number.POSITIVE_INFINITY,
    state
  );
  return entry.status === 'known'
    ? resolveCalledFunction(
        entry.expression.node,
        entry.expression.scope,
        state,
        new Set()
      )
    : undefined;
}

/** Resolves the container values Vue exposes after wrapper unwrapping. */
function resolveVueTemplateContainerSources(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): ScopedExpression[] | undefined {
  const expression = unwrapExpression(node);
  if (
    !expression ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression')
  ) {
    return undefined;
  }
  const wrapper = resolveKnownExpression(
    expression.callee,
    scope,
    state,
    new Set()
  );
  if (
    wrapper?.type !== 'vue-wrapper' &&
    wrapper?.type !== 'container-wrapper' &&
    wrapper?.type !== 'identity'
  ) {
    return undefined;
  }
  const first = expression.arguments[0];
  if (
    !first ||
    first.type === 'ArgumentPlaceholder' ||
    first.type === 'SpreadElement'
  ) {
    return [];
  }
  if (
    wrapper.type === 'container-wrapper' ||
    wrapper.type === 'identity' ||
    wrapper.kind === 'ref'
  ) {
    return [{ node: first, scope }];
  }
  const getter = resolveComputedGetter(first, scope, state);
  return getter
    ? collectFunctionReturnExpressions(getter.node, getter.scope, state)
    : [];
}

/** Resolves whether a Vue container proxy forwards or blocks direct writes. */
function readContainerWritePolicy(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): ContainerWritePolicy | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const wrapper = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (wrapper?.type !== 'container-wrapper') return undefined;
    const first = expression.arguments[0];
    const innerPolicy =
      first &&
      first.type !== 'ArgumentPlaceholder' &&
      first.type !== 'SpreadElement'
        ? readContainerWritePolicy(first, scope, state, seen)
        : undefined;
    return composeContainerWritePolicy(wrapper.kind, innerPolicy);
  }
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  if (!binding || seen.has(binding) || !binding.constant) return undefined;
  return readBindingContainerWritePolicy(binding, state, seen);
}

/** Applies Vue's proxy-idempotence rules to a nested wrapper call. */
function composeContainerWritePolicy(
  wrapper: ContainerWrapperKind,
  inner: ContainerWritePolicy | undefined
): ContainerWritePolicy {
  if (wrapper === 'to-raw') return 'forward';
  if (wrapper === 'unref') return inner ?? 'forward';
  if (inner === 'readonly-deep' || inner === 'readonly-shallow') return inner;
  if (wrapper === 'readonly') return 'readonly-deep';
  if (wrapper === 'shallow-readonly') return 'readonly-shallow';
  return 'forward';
}

/** Reads the write behavior of a direct Vue wrapper binding or exact alias. */
function readBindingContainerWritePolicy(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding> = new Set()
): ContainerWritePolicy | undefined {
  if (state.containerWritePolicies.has(binding)) {
    return state.containerWritePolicies.get(binding);
  }
  if (seen.has(binding)) return undefined;
  state.containerWritePolicies.set(binding, undefined);
  const declaration = binding.path.node;
  const policy =
    declaration.type === 'VariableDeclarator' && declaration.init
      ? readContainerWritePolicy(
          declaration.init,
          binding.path.scope,
          state,
          new Set(seen).add(binding)
        )
      : undefined;
  state.containerWritePolicies.set(binding, policy);
  return policy;
}

/** Collects the expressions returned directly by a local function. */
function collectFunctionReturnExpressions(
  fn: t.Function,
  scope: Scope,
  state: ScriptState
): ScopedExpression[] {
  const functionScope = state.scopes.get(fn) ?? scope;
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return [{ node: fn.body, scope: functionScope }];
  }
  const functionPath = state.paths.get(fn);
  if (!functionPath || fn.body.type !== 'BlockStatement') return [];
  const result: ScopedExpression[] = [];
  functionPath.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(path) {
      if (path.node.argument) {
        result.push({ node: path.node.argument, scope: path.scope });
      }
    },
  });
  return result;
}

/** Returns whether a local call can forward a translator or invoke a callback. */
function callMayCarryTranslationFunction(
  call: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
  state: ScriptState
): boolean {
  if (
    state.activeTranslationFunctions.size > 0 &&
    resolveCalledFunction(call.callee, scope, state, new Set())
  ) {
    return true;
  }
  return call.arguments.some((argument) => {
    if (argument.type === 'ArgumentPlaceholder') return false;
    const value =
      argument.type === 'SpreadElement' ? argument.argument : argument;
    return (
      expressionMayProduceStringFunction(value, scope, state, new Set()) ||
      containerMayContainStringFunction(value, scope, state, new Set()) ||
      resolveCalledFunction(value, scope, state, new Set()) !== undefined
    );
  });
}

/** Returns whether a call passes a translator, excluding ordinary callbacks. */
function callArgumentsMayProvideTranslationFunction(
  call: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
  state: ScriptState
): boolean {
  return call.arguments.some((argument) => {
    if (argument.type === 'ArgumentPlaceholder') return false;
    const value =
      argument.type === 'SpreadElement' ? argument.argument : argument;
    return (
      expressionMayProduceStringFunction(value, scope, state, new Set()) ||
      containerMayContainStringFunction(value, scope, state, new Set())
    );
  });
}

/** Runs analysis with simple call arguments bound to the callee parameters. */
function withCallParameterSubstitutions<T>(
  call: t.CallExpression | t.OptionalCallExpression,
  called: ScopedExpression & { node: t.Function },
  callScope: Scope,
  state: ScriptState,
  analyze: () => T
): T {
  const argumentsByPosition = call.arguments.map((argument) =>
    argument.type === 'ArgumentPlaceholder' || argument.type === 'SpreadElement'
      ? undefined
      : { node: argument, scope: callScope }
  );
  return withFunctionParameterSubstitutions(
    called,
    argumentsByPosition,
    state,
    analyze
  );
}

/** Runs analysis with scoped values bound to one local function's parameters. */
function withFunctionParameterSubstitutions<T>(
  called: ScopedExpression & { node: t.Function },
  values: Array<ScopedExpression | undefined>,
  state: ScriptState,
  analyze: () => T
): T {
  const functionScope = state.scopes.get(called.node) ?? called.scope;
  const substitutions = new Map<Binding, ScopedExpression>();
  called.node.params.forEach((parameter, index) => {
    const names = collectPatternBindingNames(parameter);
    const argument =
      parameter.type === 'RestElement'
        ? {
            node: {
              type: 'ArrayExpression',
              elements: values.slice(index).map((value) => value?.node ?? null),
            } as t.ArrayExpression,
            scope: values.slice(index).find(Boolean)?.scope ?? functionScope,
          }
        : values[index];
    for (const name of names) {
      const binding = functionScope.getBinding(name);
      if (!binding) continue;
      if (argument) {
        const selected = selectPatternExpression(
          parameter.type === 'RestElement' ? parameter.argument : parameter,
          argument.node,
          name,
          argument.scope,
          argument.node.end ?? Number.POSITIVE_INFINITY,
          state
        );
        if (selected) substitutions.set(binding, selected);
      } else if (
        parameter.type === 'AssignmentPattern' &&
        patternContains(parameter.left, name)
      ) {
        substitutions.set(binding, {
          node: parameter.right,
          scope: functionScope,
        });
      }
    }
  });
  if (substitutions.size === 0) return analyze();
  state.parameterSubstitutions.push(substitutions);
  try {
    return analyze();
  } finally {
    state.parameterSubstitutions.pop();
  }
}

/** Runs callback analysis with the built-in mapper's ordinary-function thisArg. */
function withFunctionThisSubstitution<T>(
  called: ScopedExpression & { node: t.Function },
  value: ScopedExpression | undefined,
  state: ScriptState,
  analyze: () => T
): T {
  if (!value || called.node.type === 'ArrowFunctionExpression') {
    return analyze();
  }
  state.thisSubstitutions.push(value);
  try {
    return analyze();
  } finally {
    state.thisSubstitutions.pop();
  }
}

/** Collects every identifier bound by one function parameter pattern. */
function collectPatternBindingNames(pattern: t.Node): string[] {
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') {
    return collectPatternBindingNames(pattern.argument);
  }
  if (pattern.type === 'AssignmentPattern') {
    return collectPatternBindingNames(pattern.left);
  }
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.flatMap((element) =>
      element ? collectPatternBindingNames(element) : []
    );
  }
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((property) =>
      collectPatternBindingNames(
        property.type === 'RestElement' ? property.argument : property.value
      )
    );
  }
  return [];
}

/** Reads the innermost active call argument for a parameter binding. */
function readParameterSubstitution(
  binding: Binding,
  state: ScriptState
): ScopedExpression | undefined {
  for (
    let index = state.parameterSubstitutions.length - 1;
    index >= 0;
    index -= 1
  ) {
    const value = state.parameterSubstitutions[index].get(binding);
    if (value) return value;
  }
  return undefined;
}

/** Reads the active mapper thisArg for an ordinary callback function. */
function readThisSubstitution(
  state: ScriptState
): ScopedExpression | undefined {
  return state.thisSubstitutions.at(-1);
}

/** Materializes a direct parameter/member return before its call scope closes. */
function materializeParameterExpression(
  node: t.Node,
  scope: Scope,
  state: ScriptState
): ScopedExpression {
  const expression = unwrapExpression(node);
  if (!expression) return { node, scope };
  if (expression.type === 'ThisExpression') {
    return readThisSubstitution(state) ?? { node: expression, scope };
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    return (
      (binding && readParameterSubstitution(binding, state)) ?? {
        node: expression,
        scope,
      }
    );
  }
  if (expression.type === 'ArrayExpression') {
    const elements = expression.elements.map((element) => {
      if (!element) return null;
      if (element.type === 'SpreadElement') {
        const value = materializeParameterExpression(
          element.argument,
          scope,
          state
        );
        return { ...element, argument: value.node as t.Expression };
      }
      return materializeParameterExpression(element, scope, state)
        .node as t.Expression;
    });
    return { node: { ...expression, elements }, scope };
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const selectedKey = readResolvedMemberProperty(expression, scope, state);
    if (selectedKey !== undefined) {
      const selected = selectStaticMemberExpression(
        expression.object,
        selectedKey,
        scope,
        state,
        expression.end ?? Number.POSITIVE_INFINITY,
        new Set()
      );
      if (selected) {
        return materializeParameterExpression(
          selected.node,
          selected.scope,
          state
        );
      }
    }
    const object = materializeParameterExpression(
      expression.object,
      scope,
      state
    ).node as typeof expression.object;
    const property = materializeParameterExpression(
      expression.property,
      scope,
      state
    ).node as typeof expression.property;
    return {
      node: { ...expression, object, property } as typeof expression,
      scope,
    };
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = materializeParameterExpression(
      expression.callee,
      scope,
      state
    ).node as typeof expression.callee;
    const args = expression.arguments.map((argument) => {
      if (argument.type === 'ArgumentPlaceholder') return argument;
      if (argument.type === 'SpreadElement') {
        return {
          ...argument,
          argument: materializeParameterExpression(
            argument.argument,
            scope,
            state
          ).node as t.Expression,
        };
      }
      return materializeParameterExpression(argument, scope, state)
        .node as t.Expression;
    });
    return {
      node: { ...expression, callee, arguments: args } as typeof expression,
      scope,
    };
  }
  return { node: expression, scope };
}

/** Returns one known value only when every reachable return agrees. */
function resolveFunctionTemplateValue(
  fn: t.Function,
  scope: Scope,
  state: ScriptState
): KnownValue | undefined {
  const functionScope = state.scopes.get(fn) ?? scope;
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return resolveTemplateKnownExpression(fn.body, functionScope, state);
  }
  // Block-bodied getters execute arbitrary application code. Their possible
  // GT identities are tracked separately and deliberately fail closed.
  return undefined;
}

function resolvePatternKnownValue(
  pattern: t.Node,
  valueNode: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  atPosition: number
): KnownValue | undefined {
  const exposedBase = readExposedMemberPath(valueNode, scope, state);
  const exposedPath = exposedBase
    ? readPatternExposedMemberPath(
        pattern,
        targetName,
        exposedBase,
        scope,
        state
      )
    : undefined;
  const exposed = exposedPath
    ? state.analysis.values.get(exposedPath)
    : undefined;
  if (exposed) return exposed;
  if (pattern.type === 'Identifier') {
    return pattern.name === targetName
      ? resolveKnownExpression(valueNode, scope, state, seen)
      : undefined;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (isStaticallyUndefined(valueNode, scope)) {
      return resolvePatternKnownValue(
        pattern.left,
        pattern.right,
        targetName,
        scope,
        state,
        seen,
        atPosition
      );
    }
    return resolvePatternKnownValue(
      pattern.left,
      valueNode,
      targetName,
      scope,
      state,
      seen,
      atPosition
    );
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type !== 'ObjectProperty') continue;
      if (!patternContains(property.value, targetName)) continue;
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) return undefined;
      const namespace = resolveKnownExpression(valueNode, scope, state, seen);
      if (namespace?.type === 'namespace') {
        return knownExport(namespace.source, key);
      }
      const entry = readObjectEntry(
        valueNode,
        key,
        scope,
        new Set(),
        atPosition,
        state
      );
      return entry.status === 'known'
        ? resolvePatternKnownValue(
            property.value,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            state,
            seen,
            atPosition
          )
        : entry.status === 'absent'
          ? resolveKnownPatternDefault(
              property.value,
              targetName,
              scope,
              state,
              seen,
              atPosition
            )
          : undefined;
    }
  }
  if (pattern.type === 'ArrayPattern') {
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      const entry = readArrayEntry(
        valueNode,
        index,
        scope,
        new Set(),
        atPosition,
        state
      );
      if (entry.status === 'absent') {
        return resolveKnownPatternDefault(
          target,
          targetName,
          scope,
          state,
          seen,
          atPosition
        );
      }
      return entry.status === 'known'
        ? resolvePatternKnownValue(
            target,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            state,
            seen,
            atPosition
          )
        : undefined;
    }
  }
  return undefined;
}

function resolveKnownPatternDefault(
  pattern: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  atPosition: number
): KnownValue | undefined {
  return pattern.type === 'AssignmentPattern' &&
    patternContains(pattern.left, targetName)
    ? resolvePatternKnownValue(
        pattern.left,
        pattern.right,
        targetName,
        scope,
        state,
        seen,
        atPosition
      )
    : undefined;
}

function getBindingSource(
  binding: Binding
): { expression: ScopedExpression; pattern: t.Node } | undefined {
  const declaration = binding.path.node;
  if (declaration.type !== 'VariableDeclarator') return undefined;

  if (declaration.init) {
    if (!binding.constant) return undefined;
    return {
      expression: { node: declaration.init, scope: binding.path.scope },
      pattern: declaration.id,
    };
  }

  if (binding.constantViolations.length !== 1) return undefined;
  const violation = binding.constantViolations[0];
  if (
    !violation.isAssignmentExpression() ||
    violation.node.operator !== '=' ||
    !isBindingPattern(violation.node.left) ||
    !isUnconditionalSiblingAssignment(binding, violation)
  ) {
    return undefined;
  }
  const assignmentEnd = violation.node.end ?? Number.POSITIVE_INFINITY;
  if (
    binding.referencePaths.some(
      (reference) => (reference.node.start ?? assignmentEnd) < assignmentEnd
    )
  ) {
    return undefined;
  }
  return {
    expression: { node: violation.node.right, scope: violation.scope },
    pattern: violation.node.left,
  };
}

/**
 * Accepts a deferred initializer only when it is an unconditional sibling
 * statement of the declaration.
 *
 * Source order alone is insufficient: assignments inside branches, loops, or
 * uncalled nested functions may never execute, so treating them as definite
 * would publish a catalog under a hash the runtime does not use.
 */
function isUnconditionalSiblingAssignment(
  binding: Binding,
  assignment: NodePath<t.AssignmentExpression>
): boolean {
  const declarationStatement = binding.path.getStatementParent();
  const assignmentStatement = assignment.getStatementParent();
  const assignmentFunction = assignment.getFunctionParent()?.node;
  return Boolean(
    declarationStatement &&
    assignmentStatement?.isExpressionStatement() &&
    declarationStatement.parentPath?.node ===
      assignmentStatement.parentPath?.node &&
    binding.referencePaths.every(
      (reference) => reference.getFunctionParent()?.node === assignmentFunction
    )
  );
}

function exposeOptionsApiBindings(
  ast: t.File,
  state: ScriptState,
  templateBindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const stateFunctions = new Map<t.Function, 'data' | 'setup'>();

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const options = resolveOptionsObject(
        path.node.declaration,
        path.scope,
        state,
        new Set()
      );
      if (!options) {
        if (hasTemplateRelevantBindings(state)) {
          addVueError(
            context,
            babelLocation(path.node.loc),
            'Could not statically resolve the Vue Options API object used with gt-vue',
            'Use a direct, immutable options object without escaped container aliases'
          );
        }
        return;
      }
      const entries = collectObjectEntries(
        options.node,
        options.scope,
        new Set(),
        Number.POSITIVE_INFINITY,
        state
      );
      if (
        hasTemplateRelevantBindings(state) &&
        (objectEntryIsUnknown(entries, 'components') ||
          objectEntryIsUnknown(entries, 'setup'))
      ) {
        addVueError(
          context,
          babelLocation(path.node.loc),
          'Could not statically resolve the Vue Options API components or setup used with gt-vue',
          'Use explicit components and setup properties after any dynamic object spreads'
        );
      }
      const components = entries.entries.get('components');
      if (components) {
        const staticComponents = readStaticFromScope(
          components.node,
          components.scope,
          new Set(),
          Number.POSITIVE_INFINITY,
          state.analysis
        );
        if (
          !isStaticallyUndefined(components.node, components.scope) &&
          !staticComponents.ok
        ) {
          exposeRegisteredComponents(
            components,
            state,
            templateBindings,
            context
          );
        }
      }
      const setup = entries.entries.get('setup');
      if (setup) {
        const setupFunction = resolveSetupFunction(
          setup.node,
          setup.scope,
          new Set()
        );
        if (setupFunction) {
          stateFunctions.set(setupFunction, 'setup');
        } else {
          const staticSetup = readStaticFromScope(
            setup.node,
            setup.scope,
            new Set(),
            Number.POSITIVE_INFINITY,
            state.analysis
          );
          if (
            hasTemplateRelevantBindings(state) &&
            !isStaticallyUndefined(setup.node, setup.scope) &&
            !staticSetup.ok
          ) {
            addVueError(
              context,
              babelLocation(setup.node.loc),
              'Could not statically resolve the Vue Options API setup function used with gt-vue',
              'Use a direct function, an immutable function alias, or an explicit undefined setup value'
            );
          }
        }
      }
      const data = entries.entries.get('data');
      if (data) {
        const dataFunction = resolveSetupFunction(
          data.node,
          data.scope,
          new Set()
        );
        if (dataFunction) {
          stateFunctions.set(dataFunction, 'data');
        } else if (hasTemplateRelevantBindings(state)) {
          addVueError(
            context,
            babelLocation(data.node.loc),
            'Could not statically resolve the Vue Options API data function used with gt-vue',
            'Use a direct function or an immutable function alias for data()'
          );
        }
      }
      const computed = entries.entries.get('computed');
      if (computed) {
        exposeOptionsComputed(computed, state, templateBindings, context);
      }
      const methods = entries.entries.get('methods');
      if (methods) {
        exposeOptionsMethods(methods, state, templateBindings, context);
      }
    },
  });

  if (stateFunctions.size === 0) return;
  const stateReturns = new Map<t.Function, Array<ScopedExpression | undefined>>(
    [...stateFunctions.keys()].map((fn) => [fn, []])
  );
  traverse(ast, {
    ArrowFunctionExpression(path) {
      if (
        stateFunctions.has(path.node) &&
        path.node.body.type !== 'BlockStatement'
      ) {
        stateReturns
          .get(path.node)
          ?.push({ node: path.node.body, scope: path.scope });
      }
    },
    ReturnStatement(path) {
      const parent = path.getFunctionParent();
      if (!parent || !stateFunctions.has(parent.node)) {
        return;
      }
      stateReturns
        .get(parent.node)
        ?.push(
          path.node.argument
            ? { node: path.node.argument, scope: path.scope }
            : undefined
        );
    },
  });
  const orderedFunctions = [...stateReturns].sort(
    ([first], [second]) =>
      Number(stateFunctions.get(first) === 'setup') -
      Number(stateFunctions.get(second) === 'setup')
  );
  for (const [fn, returns] of orderedFunctions) {
    exposeConsistentSetupReturns(
      returns,
      state,
      templateBindings,
      context,
      !setupAlwaysTerminates(fn),
      stateFunctions.get(fn) ?? 'setup'
    );
  }
}

/** Returns whether a property can still be supplied by unresolved object data. */
function objectEntryIsUnknown(
  entries: CollectedObjectEntries,
  name: string
): boolean {
  return (
    !entries.entries.has(name) &&
    (entries.unknownAll || entries.unknownNames.has(name))
  );
}

/**
 * Returns whether every reachable setup path ends before falling through.
 * Template bindings are exposed only in that case because Vue receives no
 * setup state on a fallthrough path.
 */
function setupAlwaysTerminates(setup: t.Function): boolean {
  return setup.body.type !== 'BlockStatement'
    ? true
    : blockAlwaysTerminates(setup.body);
}

function blockAlwaysTerminates(block: t.BlockStatement): boolean {
  return block.body.some(statementAlwaysTerminates);
}

function statementAlwaysTerminates(statement: t.Statement): boolean {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return blockAlwaysTerminates(statement);
  }
  if (statement.type !== 'IfStatement' || !statement.alternate) return false;
  return (
    statementAlwaysTerminates(statement.consequent) &&
    statementAlwaysTerminates(statement.alternate)
  );
}

/** Exposes statically resolved Options API component registrations. */
function exposeRegisteredComponents(
  object: ScopedExpression,
  state: ScriptState,
  templateBindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const entries = collectObjectEntries(
    object.node,
    object.scope,
    new Set(),
    Number.POSITIVE_INFINITY,
    state
  );
  if (
    hasTemplateRelevantBindings(state) &&
    (entries.unknownAll || entries.unknownNames.size > 0)
  ) {
    addVueError(
      context,
      babelLocation(object.node.loc),
      'Could not statically resolve the Vue Options API components registry used with gt-vue',
      'Use an immutable components object without dynamic spreads or escaped aliases'
    );
  }
  for (const [name, entry] of entries.entries) {
    const value = resolveKnownExpression(
      entry.node,
      entry.scope,
      state,
      new Set()
    );
    if (value?.type === 'component' || value?.type === 'vue-builtin') {
      if (value.type === 'component') {
        templateBindings.registeredComponents.set(name, value.name);
      } else {
        templateBindings.registeredVueBuiltins.set(name, value.name);
      }
    } else if (
      expressionMayProduceComponent(entry.node, entry.scope, state, new Set())
    ) {
      templateBindings.uncertainRegisteredComponents.add(name);
      if (
        expressionMayProduceComponent(
          entry.node,
          entry.scope,
          state,
          new Set(),
          'translation'
        )
      ) {
        templateBindings.uncertainRegisteredGTComponents.add(name);
      }
    }
  }
}

/** Exposes Options API computed values after Vue's automatic unwrapping. */
function exposeOptionsComputed(
  object: ScopedExpression,
  state: ScriptState,
  templateBindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const entries = collectObjectEntries(
    object.node,
    object.scope,
    new Set(),
    Number.POSITIVE_INFINITY,
    state
  );
  if (
    hasTemplateRelevantBindings(state) &&
    (entries.unknownAll || entries.unknownNames.size > 0)
  ) {
    addVueError(
      context,
      babelLocation(object.node.loc),
      'Could not statically resolve Vue Options API computed properties used with gt-vue',
      'Use an immutable computed object with statically named properties'
    );
  }
  for (const [name, entry] of entries.entries) {
    const getter =
      resolveCalledFunction(entry.node, entry.scope, state, new Set()) ??
      resolveComputedGetter(entry.node, entry.scope, state);
    if (!getter) continue;
    const known = resolveFunctionTemplateValue(
      getter.node,
      getter.scope,
      state
    );
    if (
      known?.type === 'component' ||
      known?.type === 'string' ||
      known?.type === 'vue-builtin'
    ) {
      clearTemplateBinding(name, templateBindings);
      exposeKnownValue(name, known, templateBindings, state.analysis);
      continue;
    }
    const component = functionMayReturnComponent(
      getter.node,
      getter.scope,
      state,
      new Set()
    );
    const gtComponent = functionMayReturnComponent(
      getter.node,
      getter.scope,
      state,
      new Set(),
      'translation'
    );
    const stringFunction = functionMayReturnStringFunction(
      getter.node,
      getter.scope,
      state,
      new Set()
    );
    if (component) templateBindings.uncertainComponents.add(name);
    if (gtComponent) templateBindings.uncertainGTComponents.add(name);
    if (stringFunction) {
      templateBindings.uncertainStringFunctions.add(name);
    }
    const possibleStrings = collectFunctionPossibleStaticStrings(
      getter.node,
      getter.scope,
      state
    );
    if (possibleStrings.size > 0) {
      templateBindings.possibleStaticStrings.set(name, possibleStrings);
    }
    for (const returned of collectFunctionReturnExpressions(
      getter.node,
      getter.scope,
      state
    )) {
      for (const path of collectPossibleGTContainerPaths(
        returned.node,
        returned.scope,
        name,
        state,
        new Set(),
        new Set()
      )) {
        templateBindings.possibleGTContainers.add(path);
      }
    }
  }
}

/** Exposes Options API methods that may return component identity. */
function exposeOptionsMethods(
  object: ScopedExpression,
  state: ScriptState,
  templateBindings: TemplateBindings,
  context: VueExtractionContext
): void {
  const entries = collectObjectEntries(
    object.node,
    object.scope,
    new Set(),
    Number.POSITIVE_INFINITY,
    state
  );
  if (
    hasTemplateRelevantBindings(state) &&
    (entries.unknownAll || entries.unknownNames.size > 0)
  ) {
    addVueError(
      context,
      babelLocation(object.node.loc),
      'Could not statically resolve Vue Options API methods used with gt-vue',
      'Use an immutable methods object with statically named methods'
    );
  }
  for (const [name, entry] of entries.entries) {
    const factory = readComponentFactoryExpression(
      entry.node,
      entry.scope,
      state
    );
    if (factory) {
      templateBindings.componentFactories.add(name);
      if (factory.gt) templateBindings.gtComponentFactories.add(name);
    }
    const called = resolveCalledFunction(
      entry.node,
      entry.scope,
      state,
      new Set()
    );
    if (
      called &&
      functionMayReturnGTContainer(called.node, called.scope, state, new Set())
    ) {
      templateBindings.gtContainerFactories.add(name);
    }
  }
}

/** Exposes only setup bindings that agree across every explicit return. */
function exposeConsistentSetupReturns(
  returns: Array<ScopedExpression | undefined>,
  state: ScriptState,
  templateBindings: TemplateBindings,
  context: VueExtractionContext,
  hasFallthrough: boolean,
  source: 'data' | 'setup'
): void {
  const returnValues = returns.map((entry) => {
    if (!entry || (source === 'setup' && isSetupRenderReturn(entry))) {
      return new Map<string, TemplateExposure | undefined>();
    }
    return collectTemplateExposures(entry, state, context);
  });
  if (hasFallthrough) returnValues.push(new Map());
  const first = returnValues[0];
  if (!first) return;

  const names = new Set(returnValues.flatMap((values) => [...values.keys()]));
  let reportedUncertainty = false;
  for (const name of names) {
    const exposures = returnValues.map((values) => values.get(name));
    const exposure = exposures[0];
    const consistent =
      exposure !== undefined &&
      returnValues.every(
        (values) =>
          values.has(name) && equalTemplateExposure(exposure, values.get(name))
      );
    if (!consistent) {
      if (!reportedUncertainty && exposures.some(isTemplateRelevantExposure)) {
        addVueError(
          context,
          undefined,
          `Could not statically resolve consistent Options API ${source} returns used with gt-vue`,
          `Return the same translation bindings from every reachable ${source} path`
        );
        reportedUncertainty = true;
      }
      continue;
    }
    clearTemplateBinding(name, templateBindings);
    exposeTemplateExposure(name, exposure, templateBindings);
  }
}

/** Recognizes the render-function form of an Options API setup return. */
function isSetupRenderReturn(entry: ScopedExpression): boolean {
  const expression = unwrapExpression(entry.node);
  return (
    expression?.type === 'ArrowFunctionExpression' ||
    expression?.type === 'FunctionExpression'
  );
}

/** Identifies exposures that can affect extraction or rich-content traversal. */
function isTemplateRelevantExposure(
  exposure: TemplateExposure | undefined
): boolean {
  if (
    exposure?.type === 'factory' ||
    exposure?.type === 'possible-static-strings' ||
    exposure?.type === 'uncertain' ||
    (exposure?.type === 'container' && exposure.possibleGT)
  ) {
    return true;
  }
  return (
    exposure?.type === 'known' &&
    (exposure.value.type === 'component' ||
      exposure.value.type === 'hook' ||
      exposure.value.type === 'string' ||
      exposure.value.type === 'vue-builtin' ||
      exposure.value.type === 'namespace')
  );
}

function collectTemplateExposures(
  object: ScopedExpression,
  state: ScriptState,
  context: VueExtractionContext
): Map<string, TemplateExposure | undefined> {
  const result = new Map<string, TemplateExposure | undefined>();
  const entries = collectObjectEntries(
    object.node,
    object.scope,
    new Set(),
    Number.POSITIVE_INFINITY,
    state
  );
  if (
    hasTemplateRelevantBindings(state) &&
    (entries.unknownAll || entries.unknownNames.size > 0)
  ) {
    addVueError(
      context,
      babelLocation(object.node.loc),
      'Could not statically resolve an Options API setup return used with gt-vue',
      'Return an immutable object without dynamic spreads or escaped aliases'
    );
  }
  for (const [name, entry] of entries.entries) {
    const known = resolveTemplateKnownExpression(
      entry.node,
      entry.scope,
      state
    );
    if (known) {
      result.set(name, { type: 'known', value: known });
      continue;
    }
    const called = resolveCalledFunction(
      entry.node,
      entry.scope,
      state,
      new Set()
    );
    if (called) {
      const gt = functionMayReturnComponent(
        called.node,
        called.scope,
        state,
        new Set(),
        'translation'
      );
      const vue = functionMayReturnComponent(
        called.node,
        called.scope,
        state,
        new Set(),
        'vue'
      );
      const gtContainer = functionMayReturnGTContainer(
        called.node,
        called.scope,
        state,
        new Set()
      );
      if (gt || vue || gtContainer) {
        result.set(name, { type: 'factory', gt, gtContainer });
        continue;
      }
    }
    const lengths = new Map<string, number>();
    const kinds = collectContainerKinds(
      entry.node,
      entry.scope,
      name,
      state,
      new Set(),
      new Set(),
      Number.POSITIVE_INFINITY,
      lengths
    );
    for (const [path, kind] of kinds) {
      result.set(path, {
        type: 'container',
        kind,
        length: lengths.get(path),
      });
    }
    if (
      !componentContainerShapeIsKnown(
        entry.node,
        entry.scope,
        state,
        new Set(),
        Number.POSITIVE_INFINITY
      )
    ) {
      for (const path of collectPossibleGTContainerPaths(
        entry.node,
        entry.scope,
        name,
        state,
        new Set(),
        new Set()
      )) {
        const current = result.get(path);
        result.set(
          path,
          current?.type === 'container'
            ? { ...current, possibleGT: true }
            : { type: 'container', possibleGT: true }
        );
      }
    }
    const staticValue = readStaticFromScope(
      entry.node,
      entry.scope,
      new Set(),
      Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (staticValue.ok) {
      result.set(name, { type: 'static', value: staticValue.value });
    } else if (!result.has(name)) {
      const component = expressionMayProduceComponent(
        entry.node,
        entry.scope,
        state,
        new Set()
      );
      const gtComponent = expressionMayProduceComponent(
        entry.node,
        entry.scope,
        state,
        new Set(),
        'translation'
      );
      const stringFunction = expressionMayProduceStringFunction(
        entry.node,
        entry.scope,
        state,
        new Set()
      );
      result.set(
        name,
        component || gtComponent || stringFunction
          ? {
              type: 'uncertain',
              component,
              gtComponent,
              stringFunction,
            }
          : undefined
      );
    }
    for (const [path, value] of collectStaticMemberValues(
      entry.node,
      entry.scope,
      name,
      state,
      new Set(),
      new Set(),
      Number.POSITIVE_INFINITY
    )) {
      result.set(path, { type: 'static', value });
    }
    for (const [path, values] of collectPossibleStaticStringMembers(
      entry.node,
      entry.scope,
      name,
      state,
      new Set(),
      new Set(),
      Number.POSITIVE_INFINITY
    )) {
      if (!result.get(path) || result.get(path)?.type !== 'static') {
        result.set(path, { type: 'possible-static-strings', values });
      }
    }
    for (const candidate of collectComponentMemberCandidates(
      entry.node,
      entry.scope,
      name,
      state,
      true,
      new Set(),
      new Set()
    )) {
      if (candidate.name === name) continue;
      result.set(
        candidate.name,
        candidate.certain
          ? { type: 'known', value: candidate.value }
          : {
              type: 'uncertain',
              component: candidate.value.type !== 'string',
              gtComponent: candidate.value.type === 'component',
              stringFunction: candidate.value.type === 'string',
            }
      );
    }
  }
  return result;
}

function equalTemplateExposure(
  first: TemplateExposure,
  second: TemplateExposure | undefined
): boolean {
  if (!second || first.type !== second.type) return false;
  if (first.type === 'static' && second.type === 'static') {
    return Object.is(first.value, second.value);
  }
  if (first.type === 'factory' && second.type === 'factory') {
    return first.gt === second.gt && first.gtContainer === second.gtContainer;
  }
  if (
    first.type === 'possible-static-strings' &&
    second.type === 'possible-static-strings'
  ) {
    return (
      first.values.size === second.values.size &&
      [...first.values].every((value) => second.values.has(value))
    );
  }
  if (first.type === 'container' && second.type === 'container') {
    return (
      first.kind === second.kind &&
      first.length === second.length &&
      first.possibleGT === second.possibleGT
    );
  }
  if (first.type === 'uncertain' && second.type === 'uncertain') {
    return (
      first.component === second.component &&
      first.gtComponent === second.gtComponent &&
      first.stringFunction === second.stringFunction
    );
  }
  return (
    first.type === 'known' &&
    second.type === 'known' &&
    knownValueKey(first.value) === knownValueKey(second.value)
  );
}

function exposeTemplateExposure(
  name: string,
  exposure: TemplateExposure,
  templateBindings: TemplateBindings
): void {
  if (exposure.type === 'known') {
    exposeKnownValue(name, exposure.value, templateBindings);
  } else if (exposure.type === 'container') {
    if (exposure.kind) {
      templateBindings.containerKinds.set(name, exposure.kind);
    }
    if (exposure.length !== undefined) {
      templateBindings.arrayLengths.set(name, exposure.length);
    }
    if (exposure.possibleGT) {
      templateBindings.possibleGTContainers.add(name);
    }
  } else if (exposure.type === 'uncertain') {
    if (exposure.component) {
      templateBindings.uncertainComponents.add(name);
    }
    if (exposure.gtComponent) {
      templateBindings.uncertainGTComponents.add(name);
    }
    if (exposure.stringFunction) {
      templateBindings.uncertainStringFunctions.add(name);
    }
  } else if (exposure.type === 'factory') {
    templateBindings.componentFactories.add(name);
    if (exposure.gt) templateBindings.gtComponentFactories.add(name);
    if (exposure.gtContainer) templateBindings.gtContainerFactories.add(name);
  } else if (exposure.type === 'possible-static-strings') {
    templateBindings.possibleStaticStrings.set(name, exposure.values);
  } else {
    templateBindings.staticValues.set(name, exposure.value);
  }
}

/** Reads the last value when every write is an unconditional sibling statement. */
function readDefiniteFinalBindingAssignment(
  binding: Binding
): ScopedExpression | undefined {
  if (binding.constantViolations.length === 0) return undefined;
  const assignments = binding.constantViolations.filter(
    (violation): violation is NodePath<t.AssignmentExpression> =>
      violation.isAssignmentExpression() &&
      violation.node.operator === '=' &&
      patternContains(violation.node.left, binding.identifier.name) &&
      isUnconditionalSiblingAssignment(binding, violation)
  );
  if (assignments.length !== binding.constantViolations.length) {
    return undefined;
  }
  const last = [...assignments]
    .sort((first, second) => (first.node.start ?? 0) - (second.node.start ?? 0))
    .at(-1);
  return last ? { node: last.node.right, scope: last.scope } : undefined;
}

/**
 * Reads every value a mutable binding can hold at one source position.
 * Definite sibling assignments replace earlier candidates, while an uncertain
 * write retains both branches so an alias cannot lose historical GT provenance.
 */
function readPossibleBindingValuesAtPosition(
  binding: Binding,
  atPosition: number,
  state: ScriptState
): ScopedExpression[] {
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    !patternContains(declaration.id, binding.identifier.name)
  ) {
    return [];
  }
  const initial = declaration.init
    ? selectPatternExpression(
        declaration.id,
        declaration.init,
        binding.identifier.name,
        binding.path.scope,
        declaration.init.end ?? atPosition,
        state
      )
    : undefined;
  let values = initial ? [initial] : [];
  const violations = [...binding.constantViolations]
    .filter(
      (violation) =>
        (violation.node.start ?? Number.POSITIVE_INFINITY) < atPosition
    )
    .sort(
      (first, second) =>
        (first.node.start ?? Number.POSITIVE_INFINITY) -
        (second.node.start ?? Number.POSITIVE_INFINITY)
    );
  for (const violation of violations) {
    if (
      !violation.isAssignmentExpression() ||
      violation.node.operator !== '=' ||
      !isBindingPattern(violation.node.left) ||
      !patternContains(violation.node.left, binding.identifier.name)
    ) {
      continue;
    }
    const selected = selectPatternExpression(
      violation.node.left,
      violation.node.right,
      binding.identifier.name,
      violation.scope,
      violation.node.end ?? atPosition,
      state
    );
    if (!selected) continue;
    if (isUnconditionalSiblingAssignment(binding, violation)) {
      values = [selected];
    } else {
      values.push(selected);
    }
  }
  return values;
}

/** Conservatively models whether a destructuring default can execute. */
function expressionMayBeUndefined(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  const expression = unwrapExpression(node);
  if (!expression) return true;
  const staticValue = readStaticFromScope(
    expression,
    scope,
    new Set(),
    expression.end ?? Number.POSITIVE_INFINITY,
    state.analysis
  );
  if (staticValue.ok) return staticValue.value === undefined;
  if (resolveKnownExpression(expression, scope, state, new Set())) return false;
  if (expression.type === 'Identifier') {
    if (!scope.getBinding(expression.name)) {
      return expression.name === 'undefined';
    }
    const binding = scope.getBinding(expression.name)!;
    if (seen.has(binding)) return true;
    const source = getBindingSource(binding);
    if (!source) return true;
    const selected = selectPatternExpression(
      source.pattern,
      source.expression.node,
      expression.name,
      source.expression.scope,
      source.expression.node.end ?? Number.POSITIVE_INFINITY,
      state
    );
    return selected
      ? expressionMayBeUndefined(
          selected.node,
          selected.scope,
          state,
          new Set(seen).add(binding)
        )
      : true;
  }
  if (expression.type === 'ConditionalExpression') {
    return (
      expressionMayBeUndefined(expression.consequent, scope, state, seen) ||
      expressionMayBeUndefined(expression.alternate, scope, state, seen)
    );
  }
  if (expression.type === 'LogicalExpression') return true;
  if (expression.type === 'SequenceExpression') {
    return expressionMayBeUndefined(
      expression.expressions.at(-1),
      scope,
      state,
      seen
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMayBeUndefined(expression.right, scope, state, seen);
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expressionMayBeUndefined(expression.argument, scope, state, seen);
  }
  if (expression.type === 'UnaryExpression') {
    return expression.operator === 'void';
  }
  return (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression' ||
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  );
}

const {
  readDefiniteArrayInteger,
  readDefiniteFinalContainerHasGT,
  readDefiniteFinalContainerSnapshot,
} = createSnapshotAnalysis({
  readonlyArrayTransforms: READONLY_ARRAY_TRANSFORMS,
  collectObjectEntries,
  collectTransformArrayEntries,
  memberChainIsReadOnly,
  readBindingContainerWritePolicy,
  readResolvedMemberPath,
  readResolvedMemberProperty,
  readStaticFromScope,
  resolveKnownExpression,
  resolveVueTemplateContainerSources,
});

const {
  evaluateReplayAtPosition,
  isReplayGetterStringLeaf,
  readDefiniteReplayGTContainerPaths,
  readReplayComponentCandidates,
  readReplayComponentFactoryCandidates,
  readReplayContainerMetadata,
  readReplayLeafState,
  readSafeReplayLeafOverride,
  replayBindingRetainsUnsafeIdentity,
} = createReplayAnalysis({
  ordinaryGlobalValues: ORDINARY_GLOBAL_VALUES,
  readonlyArrayTransforms: READONLY_ARRAY_TRANSFORMS,
  bindingReadsUnsafeMutableImport,
  collectFunctionReturnExpressions,
  collectPatternBindingNames,
  composeContainerWritePolicy,
  knownValueKey,
  readDefiniteArrayInteger,
  readResolvedMemberPath,
  readResolvedMemberProperty,
  readResolvedPropertyKey,
  readStaticFromScope,
  resolveCalledFunction,
  resolveComputedGetter,
  resolveKnownExpression,
});

/**
 * Describes whether a program binding is a container that can directly yield
 * `<T>`, or a callable that can return such a container.
 *
 * Keeping these cases separate avoids treating a function object as though
 * indexing the function itself could select one of its returned values.
 */
function readBindingGTContainerExposure(
  binding: Binding,
  state: ScriptState
): GTContainerExposure {
  const result: GTContainerExposure = {
    containers: new Set(),
    factories: new Set(),
  };
  const sources: ScopedExpression[] = [];
  const source = getBindingSource(binding);
  if (source) {
    const selected = selectPatternExpression(
      source.pattern,
      source.expression.node,
      binding.identifier.name,
      source.expression.scope,
      source.expression.node.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (selected) sources.push(selected);
  } else {
    const finalAssignment = readDefiniteFinalBindingAssignment(binding);
    if (finalAssignment) sources.push(finalAssignment);
  }

  for (const candidate of sources) {
    const callable = resolveCalledFunction(
      candidate.node,
      candidate.scope,
      state,
      new Set()
    );
    if (callable) {
      if (
        functionMayReturnGTContainer(
          callable.node,
          callable.scope,
          state,
          new Set()
        )
      ) {
        result.factories.add(binding.identifier.name);
      }
    } else {
      const candidatePaths = collectPossibleGTContainerPaths(
        candidate.node,
        candidate.scope,
        binding.identifier.name,
        state,
        new Set(),
        new Set([binding])
      );
      for (const path of candidatePaths) {
        result.containers.add(path);
      }
    }
  }

  for (const violation of binding.constantViolations) {
    if (
      !violation.isAssignmentExpression() ||
      !patternContains(violation.node.left, binding.identifier.name)
    ) {
      continue;
    }
    for (const path of collectPossibleGTContainerPaths(
      violation.node.right,
      violation.scope,
      binding.identifier.name,
      state,
      new Set(),
      new Set([binding])
    )) {
      result.containers.add(path);
    }
  }

  const mutationPaths = bindingMutationGTContainerPaths(binding, state);
  for (const path of mutationPaths) result.containers.add(path);
  const replayPaths = readDefiniteReplayGTContainerPaths(binding, state);
  if (replayPaths === null) {
    result.containers.add(binding.identifier.name);
  } else if (replayPaths) {
    result.containers = replayPaths;
  } else {
    const finalHasGT = readDefiniteFinalContainerHasGT(binding, state);
    if (finalHasGT === false) result.containers.clear();
  }
  const declaration = binding.path.node;
  if (
    replayPaths !== null &&
    !replayBindingRetainsUnsafeIdentity(binding, state) &&
    result.containers.size > 0 &&
    mutationPaths.size === 0 &&
    sources.length === 1 &&
    declaration.type === 'VariableDeclarator' &&
    declaration.id.type === 'Identifier' &&
    Boolean(declaration.init) &&
    binding.constant &&
    isSafelyReadContainerBinding(
      binding,
      binding.identifier,
      Number.POSITIVE_INFINITY,
      false,
      state
    ) &&
    componentContainerShapeIsKnown(
      sources[0].node,
      sources[0].scope,
      state,
      new Set(),
      Number.POSITIVE_INFINITY
    )
  ) {
    // Exact immutable leaves are already exposed by
    // collectProgramComponentMembers; a broad taint would hide that precision.
    result.containers.clear();
  }
  return result;
}

/** Returns whether a callable can return a container with an immediate T. */
function functionMayReturnGTContainer(
  fn: t.Function,
  scope: Scope,
  state: ScriptState,
  seenNodes: Set<t.Node>
): boolean {
  if (seenNodes.has(fn)) return false;
  const nextNodes = new Set(seenNodes).add(fn);
  return collectFunctionReturnExpressions(fn, scope, state).some((value) =>
    expressionMayProduceGTContainer(
      value.node,
      value.scope,
      state,
      nextNodes,
      new Set()
    )
  );
}

/** Returns whether one callback return preserves the selected parameter value. */
function functionMayReturnParameter(
  fn: t.Function,
  scope: Scope,
  parameterIndex: number,
  state: ScriptState
): boolean {
  const parameter = fn.params[parameterIndex];
  if (!parameter) return false;
  const functionScope = state.scopes.get(fn) ?? scope;
  const parameterBindings = new Set(
    collectPatternBindingNames(parameter).flatMap((name) => {
      const binding = functionScope.getBinding(name);
      return binding ? [binding] : [];
    })
  );
  return collectFunctionReturnExpressions(fn, scope, state).some((value) =>
    expressionMayResolveToBinding(
      value.node,
      value.scope,
      parameterBindings,
      new Set()
    )
  );
}

/** Tracks exact value-preserving aliases without treating member reads as identity. */
function expressionMayResolveToBinding(
  node: t.Node | null | undefined,
  scope: Scope,
  targets: Set<Binding>,
  seen: Set<Binding>
): boolean {
  const expression = unwrapExpression(node);
  if (!expression) return false;
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) return false;
    if (targets.has(binding)) return true;
    if (seen.has(binding)) return false;
    const source = getBindingSource(binding);
    return Boolean(
      source?.pattern.type === 'Identifier' &&
      expressionMayResolveToBinding(
        source.expression.node,
        source.expression.scope,
        targets,
        new Set(seen).add(binding)
      )
    );
  }
  if (expression.type === 'ConditionalExpression') {
    return (
      expressionMayResolveToBinding(
        expression.consequent,
        scope,
        targets,
        seen
      ) ||
      expressionMayResolveToBinding(expression.alternate, scope, targets, seen)
    );
  }
  if (expression.type === 'LogicalExpression') {
    return (
      expressionMayResolveToBinding(expression.left, scope, targets, seen) ||
      expressionMayResolveToBinding(expression.right, scope, targets, seen)
    );
  }
  if (expression.type === 'SequenceExpression') {
    return expressionMayResolveToBinding(
      expression.expressions.at(-1),
      scope,
      targets,
      seen
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMayResolveToBinding(
      expression.right,
      scope,
      targets,
      seen
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expressionMayResolveToBinding(
      expression.argument,
      scope,
      targets,
      seen
    );
  }
  return false;
}

/**
 * Collects the flattened paths of containers that can directly yield `<T>`.
 * A path is attached to the container, not the T leaf, which preserves the
 * distinction between `[T]` and `[[T]]` across successive template indexes.
 */
function collectPossibleGTContainerPaths(
  node: t.Node | null | undefined,
  scope: Scope,
  basePath: string,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>
): Set<string> {
  const result = new Set<string>();
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return result;
  const nextNodes = new Set(seenNodes).add(expression);
  const transformedEntries =
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
      ? collectTransformArrayEntries(
          expression,
          scope,
          state,
          new Set(),
          expression.end ?? Number.POSITIVE_INFINITY
        )
      : undefined;
  if (
    transformedEntries === undefined &&
    expressionMayProduceGTContainer(
      expression,
      scope,
      state,
      seenNodes,
      seenBindings
    )
  ) {
    result.add(basePath);
  }
  const collect = (
    value: t.Node | null | undefined,
    valueScope: Scope,
    path: string
  ): void => {
    for (const candidate of collectPossibleGTContainerPaths(
      value,
      valueScope,
      path,
      state,
      nextNodes,
      seenBindings
    )) {
      result.add(candidate);
    }
  };

  if (transformedEntries !== undefined) {
    if (
      transformedEntries.some(
        (entry) =>
          entry &&
          expressionMayProduceComponent(
            entry.node,
            entry.scope,
            state,
            new Set(),
            'T'
          )
      )
    ) {
      result.add(basePath);
    }
    transformedEntries.forEach((entry, index) => {
      if (entry) {
        collect(
          entry.node,
          entry.scope,
          appendTemplatePath(basePath, String(index))
        );
      }
    });
    return result;
  }

  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      const prefix = `${expression.name}.`;
      for (const values of [
        state.analysis.values,
        state.analysis.templateValues,
      ]) {
        for (const [path, value] of values) {
          if (
            value.type !== 'component' ||
            value.name !== 'T' ||
            !path.startsWith(prefix)
          ) {
            continue;
          }
          const parent = path.slice(0, path.lastIndexOf('.'));
          result.add(`${basePath}${parent.slice(expression.name.length)}`);
        }
      }
      for (const path of state.analysis.possibleGTContainers) {
        if (path === expression.name || path.startsWith(prefix)) {
          result.add(`${basePath}${path.slice(expression.name.length)}`);
        }
      }
      return result;
    }
    const substitution = readParameterSubstitution(binding, state);
    if (substitution) {
      for (const candidate of collectPossibleGTContainerPaths(
        substitution.node,
        substitution.scope,
        basePath,
        state,
        nextNodes,
        seenBindings
      )) {
        result.add(candidate);
      }
      return result;
    }
    if (seenBindings.has(binding)) return result;
    const cacheable =
      binding.constant && state.parameterSubstitutions.length === 0;
    const remapCached = (paths: Iterable<string>): void => {
      for (const path of paths) {
        result.add(
          path === binding.identifier.name
            ? basePath
            : `${basePath}${path.slice(binding.identifier.name.length)}`
        );
      }
    };
    const cached = cacheable ? state.gtContainerPaths.get(binding) : undefined;
    if (cached) {
      remapCached(cached);
      return result;
    }
    if (cacheable && state.gtContainerPathsInProgress.has(binding)) {
      return result;
    }
    if (cacheable) state.gtContainerPathsInProgress.add(binding);
    const source = getBindingSource(binding);
    const selectedValues = source
      ? [
          selectPatternExpression(
            source.pattern,
            source.expression.node,
            binding.identifier.name,
            source.expression.scope,
            source.expression.node.end ?? Number.POSITIVE_INFINITY,
            state
          ),
        ]
      : readPossibleBindingValuesAtPosition(
          binding,
          expression.start ?? Number.POSITIVE_INFINITY,
          state
        );
    try {
      const canonicalBase = cacheable ? binding.identifier.name : basePath;
      const canonical = new Set<string>();
      if (result.has(basePath)) canonical.add(canonicalBase);
      for (const selected of selectedValues) {
        if (!selected) continue;
        for (const candidate of collectPossibleGTContainerPaths(
          selected.node,
          selected.scope,
          canonicalBase,
          state,
          nextNodes,
          new Set(seenBindings).add(binding)
        )) {
          canonical.add(candidate);
        }
      }
      for (const path of bindingMutationGTContainerPaths(
        binding,
        state,
        new Set(seenBindings).add(binding)
      )) {
        canonical.add(
          cacheable
            ? path
            : path === binding.identifier.name
              ? basePath
              : `${basePath}${path.slice(binding.identifier.name.length)}`
        );
      }
      if (cacheable) {
        state.gtContainerPaths.set(binding, canonical);
        remapCached(canonical);
      } else {
        for (const path of canonical) result.add(path);
      }
      return result;
    } finally {
      if (cacheable) state.gtContainerPathsInProgress.delete(binding);
    }
  }

  if (expression.type === 'ArrayExpression') {
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (entries) {
      entries.forEach((entry, index) => {
        if (entry)
          collect(
            entry.node,
            entry.scope,
            appendTemplatePath(basePath, String(index))
          );
      });
      return result;
    }
    let uncertainIndex = false;
    expression.elements.forEach((element, index) => {
      if (!element) return;
      if (element.type === 'SpreadElement') {
        uncertainIndex = true;
        collect(element.argument, scope, basePath);
        return;
      }
      collect(
        element,
        scope,
        appendTemplatePath(
          basePath,
          uncertainIndex ? unknownTemplatePathSegment : String(index)
        )
      );
    });
    return result;
  }

  if (expression.type === 'ObjectExpression') {
    const entries = collectObjectEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    for (const [key, entry] of entries.entries) {
      collect(entry.node, entry.scope, appendTemplatePath(basePath, key));
    }
    for (const property of expression.properties) {
      if (property.type === 'SpreadElement') continue;
      if (readResolvedPropertyKey(property, scope, state) !== undefined) {
        continue;
      }
      const value =
        property.type === 'ObjectProperty' ? property.value : property;
      collect(
        value,
        scope,
        appendTemplatePath(basePath, unknownTemplatePathSegment)
      );
    }
    return result;
  }

  if (expression.type === 'ConditionalExpression') {
    const condition = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (condition.ok) {
      collect(
        condition.value ? expression.consequent : expression.alternate,
        scope,
        basePath
      );
    } else {
      collect(expression.consequent, scope, basePath);
      collect(expression.alternate, scope, basePath);
    }
    return result;
  }
  if (expression.type === 'LogicalExpression') {
    collect(expression.left, scope, basePath);
    collect(expression.right, scope, basePath);
    return result;
  }
  if (expression.type === 'SequenceExpression') {
    collect(expression.expressions.at(-1), scope, basePath);
    return result;
  }
  if (expression.type === 'AssignmentExpression') {
    collect(expression.right, scope, basePath);
    return result;
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    collect(expression.argument, scope, basePath);
    return result;
  }
  if (
    expression.type !== 'CallExpression' &&
    expression.type !== 'OptionalCallExpression'
  ) {
    return result;
  }

  const sources = resolveVueTemplateContainerSources(expression, scope, state);
  if (sources) {
    for (const source of sources) collect(source.node, source.scope, basePath);
    return result;
  }
  const called = resolveCalledFunction(
    expression.callee,
    scope,
    state,
    new Set()
  );
  if (called) {
    withCallParameterSubstitutions(expression, called, scope, state, () => {
      for (const returned of collectFunctionReturnExpressions(
        called.node,
        called.scope,
        state
      )) {
        collect(returned.node, returned.scope, basePath);
      }
    });
    return result;
  }
  if (callTargetsUnknownImport(expression.callee, scope)) {
    for (const argument of expression.arguments) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      collect(
        argument.type === 'SpreadElement' ? argument.argument : argument,
        scope,
        basePath
      );
    }
    return result;
  }
  const callee = unwrapExpression(expression.callee);
  if (
    !callee ||
    (callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression')
  ) {
    return result;
  }
  const method = readResolvedMemberProperty(callee, scope, state);
  if (!method) return result;
  const addPaths = (paths: Iterable<string>): void => {
    for (const path of paths) result.add(path);
  };
  const collectPaths = (
    value: t.Node,
    valueScope: Scope,
    path = basePath
  ): Set<string> =>
    collectPossibleGTContainerPaths(
      value,
      valueScope,
      path,
      state,
      nextNodes,
      seenBindings
    );
  const removeFirstChild = (path: string): string => {
    if (path === basePath) return basePath;
    const suffix = path.slice(basePath.length + 1);
    const separator = suffix.indexOf('.');
    return separator === -1
      ? basePath
      : `${basePath}.${suffix.slice(separator + 1)}`;
  };
  const replaceFirstChildWithUnknown = (path: string): string => {
    if (path === basePath) return basePath;
    const suffix = path.slice(basePath.length + 1);
    const separator = suffix.indexOf('.');
    const remaining = separator === -1 ? '' : suffix.slice(separator);
    return `${appendTemplatePath(basePath, unknownTemplatePathSegment)}${remaining}`;
  };
  const receiverPath = readResolvedMemberPath(callee.object, scope, state);
  const collectMappedPaths = (
    source: t.Node,
    callback: t.Node | undefined,
    includeSourceParameter = true
  ): Set<string> => {
    const sourcePaths = collectPaths(source, scope);
    if (!callback) return sourcePaths;
    const callbackFunction = resolveCalledFunction(
      callback,
      scope,
      state,
      new Set()
    );
    if (!callbackFunction) return sourcePaths;
    const mapped = new Set<string>();
    const sourceEntries = collectTransformArrayEntries(
      source,
      scope,
      state,
      new Set()
    );
    if (sourceEntries) {
      const childPath = appendTemplatePath(
        basePath,
        unknownTemplatePathSegment
      );
      for (const [index, entry] of sourceEntries.entries()) {
        if (!entry) continue;
        const callbackValues: Array<ScopedExpression | undefined> = [
          entry,
          {
            node: { type: 'NumericLiteral', value: index } as t.NumericLiteral,
            scope,
          },
        ];
        if (includeSourceParameter)
          callbackValues.push({ node: source, scope });
        withFunctionParameterSubstitutions(
          callbackFunction,
          callbackValues,
          state,
          () => {
            if (
              functionMayReturnComponent(
                callbackFunction.node,
                callbackFunction.scope,
                state,
                new Set(),
                'T'
              )
            ) {
              mapped.add(basePath);
            }
            for (const returned of collectFunctionReturnExpressions(
              callbackFunction.node,
              callbackFunction.scope,
              state
            )) {
              for (const path of collectPossibleGTContainerPaths(
                returned.node,
                returned.scope,
                childPath,
                state,
                nextNodes,
                seenBindings
              )) {
                mapped.add(path);
              }
            }
          }
        );
      }
      return mapped;
    }
    if (
      functionMayReturnParameter(
        callbackFunction.node,
        callbackFunction.scope,
        0,
        state
      )
    ) {
      for (const path of sourcePaths) mapped.add(path);
    }
    if (
      functionMayReturnComponent(
        callbackFunction.node,
        callbackFunction.scope,
        state,
        new Set(),
        'T'
      )
    ) {
      mapped.add(basePath);
    }
    const childPath = appendTemplatePath(basePath, unknownTemplatePathSegment);
    for (const returned of collectFunctionReturnExpressions(
      callbackFunction.node,
      callbackFunction.scope,
      state
    )) {
      for (const path of collectPossibleGTContainerPaths(
        returned.node,
        returned.scope,
        childPath,
        state,
        nextNodes,
        seenBindings
      )) {
        mapped.add(path);
      }
    }
    return mapped;
  };
  if (
    receiverPath === 'Array' &&
    method === 'from' &&
    !scope.getBinding('Array')
  ) {
    const source = expression.arguments[0];
    if (
      source &&
      source.type !== 'ArgumentPlaceholder' &&
      source.type !== 'SpreadElement'
    ) {
      const mapper = expression.arguments[1];
      addPaths(
        collectMappedPaths(
          source,
          mapper &&
            mapper.type !== 'ArgumentPlaceholder' &&
            mapper.type !== 'SpreadElement'
            ? mapper
            : undefined,
          false
        )
      );
    }
    return result;
  }
  if (
    receiverPath === 'Object' &&
    method === 'assign' &&
    !scope.getBinding('Object')
  ) {
    for (const argument of expression.arguments) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      collect(
        argument.type === 'SpreadElement' ? argument.argument : argument,
        scope,
        basePath
      );
    }
    return result;
  }
  if (
    receiverPath === 'Object' &&
    (method === 'values' || method === 'entries') &&
    !scope.getBinding('Object')
  ) {
    const source = expression.arguments[0];
    if (
      source &&
      source.type !== 'ArgumentPlaceholder' &&
      source.type !== 'SpreadElement'
    ) {
      for (const path of collectPaths(source, scope)) {
        const valuePath = replaceFirstChildWithUnknown(path);
        result.add(
          method === 'entries'
            ? path === basePath
              ? appendTemplatePath(basePath, unknownTemplatePathSegment)
              : appendTemplatePath(valuePath, '1')
            : valuePath
        );
      }
    }
    return result;
  }
  if (
    [
      'concat',
      'copyWithin',
      'fill',
      'filter',
      'splice',
      'reverse',
      'slice',
      'sort',
      'toReversed',
      'toSorted',
      'toSpliced',
      'with',
    ].includes(method)
  ) {
    collect(callee.object, scope, basePath);
  }
  if (method === 'concat') {
    for (const argument of expression.arguments) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      collect(
        argument.type === 'SpreadElement' ? argument.argument : argument,
        scope,
        basePath
      );
    }
  }
  if (method === 'with' || method === 'toSpliced') {
    const inserted =
      method === 'with'
        ? expression.arguments.slice(1, 2)
        : expression.arguments.slice(2);
    const childPath = appendTemplatePath(basePath, unknownTemplatePathSegment);
    for (const argument of inserted) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      const value =
        argument.type === 'SpreadElement' ? argument.argument : argument;
      if (expressionMayProduceComponent(value, scope, state, new Set(), 'T')) {
        result.add(basePath);
      }
      collect(value, scope, childPath);
    }
  }
  if (method === 'fill') {
    const value = expression.arguments[0];
    if (
      value &&
      value.type !== 'ArgumentPlaceholder' &&
      value.type !== 'SpreadElement'
    ) {
      if (expressionMayProduceComponent(value, scope, state, new Set(), 'T')) {
        result.add(basePath);
      }
      collect(
        value,
        scope,
        appendTemplatePath(basePath, unknownTemplatePathSegment)
      );
    }
  }
  if (method === 'map') {
    const callback = expression.arguments[0];
    addPaths(
      collectMappedPaths(
        callee.object,
        callback &&
          callback.type !== 'ArgumentPlaceholder' &&
          callback.type !== 'SpreadElement'
          ? callback
          : undefined
      )
    );
  }
  if (method === 'flat' || method === 'flatMap') {
    const mapped = new Set<string>();
    if (method === 'flat') {
      const sourcePaths = collectPaths(callee.object, scope);
      const depthArgument = expression.arguments[0];
      const depthValue =
        depthArgument &&
        depthArgument.type !== 'ArgumentPlaceholder' &&
        depthArgument.type !== 'SpreadElement'
          ? readStaticFromScope(
              depthArgument,
              scope,
              new Set(),
              depthArgument.end ?? Number.POSITIVE_INFINITY,
              state.analysis
            )
          : { ok: true as const, value: 1 };
      if (depthValue.ok && typeof depthValue.value !== 'bigint') {
        const numericDepth = Number(depthValue.value);
        const depth = Number.isNaN(numericDepth)
          ? 0
          : numericDepth === Number.POSITIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.trunc(numericDepth));
        for (const sourcePath of sourcePaths) {
          let flattened = sourcePath;
          for (
            let index = 0;
            index < depth && flattened !== basePath;
            index += 1
          ) {
            flattened = removeFirstChild(flattened);
          }
          mapped.add(flattened);
        }
      } else if (!depthValue.ok) {
        for (const sourcePath of sourcePaths) {
          let flattened = sourcePath;
          mapped.add(flattened);
          while (flattened !== basePath) {
            flattened = removeFirstChild(flattened);
            mapped.add(flattened);
          }
        }
      }
    } else {
      const callback = expression.arguments[0];
      for (const path of collectMappedPaths(
        callee.object,
        callback &&
          callback.type !== 'ArgumentPlaceholder' &&
          callback.type !== 'SpreadElement'
          ? callback
          : undefined
      )) {
        mapped.add(removeFirstChild(path));
      }
    }
    addPaths(mapped);
  }
  if (method === 'reduce' || method === 'reduceRight') {
    const receiverPaths = collectPaths(callee.object, scope);
    addPaths(receiverPaths);
    if (receiverPaths.size > 0) result.add(basePath);
    const callback = expression.arguments[0];
    if (
      callback &&
      callback.type !== 'ArgumentPlaceholder' &&
      callback.type !== 'SpreadElement'
    ) {
      const callbackFunction = resolveCalledFunction(
        callback,
        scope,
        state,
        new Set()
      );
      if (callbackFunction) {
        if (
          functionMayReturnComponent(
            callbackFunction.node,
            callbackFunction.scope,
            state,
            new Set(),
            'T'
          )
        ) {
          result.add(basePath);
        }
        for (const returned of collectFunctionReturnExpressions(
          callbackFunction.node,
          callbackFunction.scope,
          state
        )) {
          collect(returned.node, returned.scope, basePath);
        }
      }
    }
    for (const argument of expression.arguments) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      const value =
        argument.type === 'SpreadElement' ? argument.argument : argument;
      addPaths(collectPaths(value, scope));
      if (expressionMayProduceComponent(value, scope, state, new Set(), 'T')) {
        result.add(basePath);
      }
    }
  }
  return result;
}

/**
 * Tracks containers whose immediate indexed/property value can be `<T>`.
 * Nested containers deliberately do not taint their parent: selecting from
 * `[[T]]` yields an array, and only a second selection can yield T.
 */
function expressionMayProduceGTContainer(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>
): boolean {
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return false;
  const nextNodes = new Set(seenNodes).add(expression);
  const exposedPath = readExposedMemberPath(expression, scope, state);
  if (exposedPath && state.analysis.possibleGTContainers.has(exposedPath)) {
    return true;
  }

  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      return state.analysis.possibleGTContainers.has(expression.name);
    }
    const substitution = readParameterSubstitution(binding, state);
    if (substitution) {
      return expressionMayProduceGTContainer(
        substitution.node,
        substitution.scope,
        state,
        nextNodes,
        seenBindings
      );
    }
    const cacheable = state.parameterSubstitutions.length === 0;
    const cached = cacheable
      ? state.gtContainerPossibilities.get(binding)
      : undefined;
    if (cached !== undefined) return cached;
    if (seenBindings.has(binding)) return false;
    if (state.gtContainerPossibilitiesInProgress.has(binding)) return false;
    if (cacheable) state.gtContainerPossibilitiesInProgress.add(binding);
    try {
      const source = getBindingSource(binding);
      const finalAssignment = source
        ? undefined
        : readDefiniteFinalBindingAssignment(binding);
      const selected = source
        ? selectPatternExpression(
            source.pattern,
            source.expression.node,
            binding.identifier.name,
            source.expression.scope,
            source.expression.node.end ?? Number.POSITIVE_INFINITY,
            state
          )
        : finalAssignment;
      const result = Boolean(
        selected &&
        expressionMayProduceGTContainer(
          selected.node,
          selected.scope,
          state,
          nextNodes,
          new Set(seenBindings).add(binding)
        )
      );
      if (cacheable) state.gtContainerPossibilities.set(binding, result);
      return result;
    } finally {
      if (cacheable) state.gtContainerPossibilitiesInProgress.delete(binding);
    }
  }

  if (expression.type === 'ArrayExpression') {
    const entries = collectArrayEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (entries) {
      return entries.some(
        (entry) =>
          entry &&
          expressionMayProduceComponent(
            entry.node,
            entry.scope,
            state,
            new Set(),
            'T'
          )
      );
    }
    return expression.elements.some((element) => {
      if (!element) return false;
      return element.type === 'SpreadElement'
        ? expressionMayProduceGTContainer(
            element.argument,
            scope,
            state,
            nextNodes,
            seenBindings
          )
        : expressionMayProduceComponent(element, scope, state, new Set(), 'T');
    });
  }

  if (expression.type === 'ObjectExpression') {
    const entries = collectObjectEntries(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (
      [...entries.entries.values()].some((entry) =>
        entry.node.type === 'ObjectMethod'
          ? entry.node.kind === 'get' &&
            functionMayReturnComponent(
              entry.node,
              entry.scope,
              state,
              new Set(),
              'T'
            )
          : expressionMayProduceComponent(
              entry.node,
              entry.scope,
              state,
              new Set(),
              'T'
            )
      )
    ) {
      return true;
    }
    return expression.properties.some((property) => {
      if (property.type === 'SpreadElement') {
        return expressionMayProduceGTContainer(
          property.argument,
          scope,
          state,
          nextNodes,
          seenBindings
        );
      }
      return (
        property.computed &&
        readResolvedPropertyKey(property, scope, state) === undefined &&
        (property.type === 'ObjectMethod'
          ? property.kind === 'get' &&
            functionMayReturnComponent(property, scope, state, new Set(), 'T')
          : expressionMayProduceComponent(
              property.value,
              scope,
              state,
              new Set(),
              'T'
            ))
      );
    });
  }

  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const sources = resolveVueTemplateContainerSources(
      expression,
      scope,
      state
    );
    if (sources) {
      return sources.some((source) =>
        expressionMayProduceGTContainer(
          source.node,
          source.scope,
          state,
          nextNodes,
          seenBindings
        )
      );
    }
    const calleePath = readResolvedMemberPath(expression.callee, scope, state);
    if (calleePath && state.analysis.gtContainerFactories.has(calleePath)) {
      return true;
    }
    const called = resolveCalledFunction(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (called) {
      const mayReturnContainer = withCallParameterSubstitutions(
        expression,
        called,
        scope,
        state,
        () =>
          functionMayReturnGTContainer(
            called.node,
            called.scope,
            state,
            nextNodes
          )
      );
      if (mayReturnContainer) return true;
    }
    return callMayProduceGTContainer(
      expression,
      scope,
      state,
      nextNodes,
      seenBindings
    );
  }

  if (expression.type === 'ConditionalExpression') {
    const condition = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    const alternatives = condition.ok
      ? [condition.value ? expression.consequent : expression.alternate]
      : [expression.consequent, expression.alternate];
    return alternatives.some((alternative) =>
      expressionMayProduceGTContainer(
        alternative,
        scope,
        state,
        nextNodes,
        seenBindings
      )
    );
  }
  if (expression.type === 'LogicalExpression') {
    const staticLeft = readStaticFromScope(
      expression.left,
      scope,
      new Set(),
      expression.left.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (staticLeft.ok) {
      const selectsRight =
        expression.operator === '??'
          ? staticLeft.value == null
          : expression.operator === '||'
            ? !staticLeft.value
            : Boolean(staticLeft.value);
      return selectsRight
        ? expressionMayProduceGTContainer(
            expression.right,
            scope,
            state,
            nextNodes,
            seenBindings
          )
        : expressionMayProduceGTContainer(
            expression.left,
            scope,
            state,
            nextNodes,
            seenBindings
          );
    }
    return (
      expressionMayProduceGTContainer(
        expression.left,
        scope,
        state,
        nextNodes,
        seenBindings
      ) ||
      expressionMayProduceGTContainer(
        expression.right,
        scope,
        state,
        nextNodes,
        seenBindings
      )
    );
  }
  if (expression.type === 'SequenceExpression') {
    return expressionMayProduceGTContainer(
      expression.expressions.at(-1),
      scope,
      state,
      nextNodes,
      seenBindings
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMayProduceGTContainer(
      expression.right,
      scope,
      state,
      nextNodes,
      seenBindings
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expressionMayProduceGTContainer(
      expression.argument,
      scope,
      state,
      nextNodes,
      seenBindings
    );
  }
  return false;
}

/** Models standard calls that preserve or create array registry values. */
function callMayProduceGTContainer(
  call: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
  state: ScriptState,
  seenNodes: Set<t.Node>,
  seenBindings: Set<Binding>
): boolean {
  const callee = unwrapExpression(call.callee);
  if (
    !callee ||
    (callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression')
  ) {
    return false;
  }
  const method = readResolvedMemberProperty(callee, scope, state);
  if (!method) return false;
  const first = call.arguments[0];
  const firstExpression =
    first &&
    first.type !== 'ArgumentPlaceholder' &&
    first.type !== 'SpreadElement'
      ? first
      : undefined;
  const receiverPath = readResolvedMemberPath(callee.object, scope, state);
  if (
    receiverPath === 'Array' &&
    method === 'from' &&
    !scope.getBinding('Array')
  ) {
    const sourceHasT = expressionMayProduceGTContainer(
      firstExpression,
      scope,
      state,
      seenNodes,
      seenBindings
    );
    const mapper = call.arguments[1];
    if (
      !mapper ||
      mapper.type === 'ArgumentPlaceholder' ||
      mapper.type === 'SpreadElement'
    ) {
      return sourceHasT;
    }
    const mapperFunction = resolveCalledFunction(
      mapper,
      scope,
      state,
      new Set()
    );
    if (!mapperFunction) return sourceHasT;
    return (
      (sourceHasT &&
        functionMayReturnParameter(
          mapperFunction.node,
          mapperFunction.scope,
          0,
          state
        )) ||
      functionMayReturnComponent(
        mapperFunction.node,
        mapperFunction.scope,
        state,
        new Set(),
        'T'
      )
    );
  }
  if (
    receiverPath === 'Object' &&
    method === 'assign' &&
    !scope.getBinding('Object')
  ) {
    return call.arguments.some(
      (argument) =>
        argument.type !== 'ArgumentPlaceholder' &&
        expressionMayProduceGTContainer(
          argument.type === 'SpreadElement' ? argument.argument : argument,
          scope,
          state,
          seenNodes,
          seenBindings
        )
    );
  }
  if (
    receiverPath === 'Object' &&
    ['freeze', 'seal', 'preventExtensions'].includes(method) &&
    !scope.getBinding('Object')
  ) {
    return expressionMayProduceGTContainer(
      firstExpression,
      scope,
      state,
      seenNodes,
      seenBindings
    );
  }
  const receiverHasT = expressionMayProduceGTContainer(
    callee.object,
    scope,
    state,
    seenNodes,
    seenBindings
  );
  if (
    ['filter', 'reverse', 'slice', 'sort', 'toReversed', 'toSorted'].includes(
      method
    )
  ) {
    return receiverHasT;
  }
  if (method === 'map') {
    const mapper = call.arguments[0];
    if (
      !mapper ||
      mapper.type === 'ArgumentPlaceholder' ||
      mapper.type === 'SpreadElement'
    ) {
      return receiverHasT;
    }
    const mapperFunction = resolveCalledFunction(
      mapper,
      scope,
      state,
      new Set()
    );
    if (!mapperFunction) return receiverHasT;
    return (
      (receiverHasT &&
        functionMayReturnParameter(
          mapperFunction.node,
          mapperFunction.scope,
          0,
          state
        )) ||
      functionMayReturnComponent(
        mapperFunction.node,
        mapperFunction.scope,
        state,
        new Set(),
        'T'
      )
    );
  }
  if (method === 'concat') {
    return (
      receiverHasT ||
      call.arguments.some(
        (argument) =>
          argument.type !== 'ArgumentPlaceholder' &&
          (expressionMayProduceComponent(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            state,
            new Set(),
            'T'
          ) ||
            expressionMayProduceGTContainer(
              argument.type === 'SpreadElement' ? argument.argument : argument,
              scope,
              state,
              seenNodes,
              seenBindings
            ))
      )
    );
  }
  if (method === 'fill') {
    return Boolean(
      firstExpression &&
      expressionMayProduceComponent(
        firstExpression,
        scope,
        state,
        new Set(),
        'T'
      )
    );
  }
  if (['with', 'toSpliced'].includes(method)) {
    const inserted =
      method === 'toSpliced'
        ? call.arguments.slice(2)
        : method === 'with'
          ? call.arguments.slice(1, 2)
          : [first];
    return (
      receiverHasT ||
      inserted.some(
        (argument) =>
          argument &&
          argument.type !== 'ArgumentPlaceholder' &&
          expressionMayProduceComponent(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            state,
            new Set(),
            'T'
          )
      )
    );
  }
  return receiverHasT && method === 'copyWithin';
}

/** Collects container paths affected by in-place writes that can add T. */
function bindingMutationGTContainerPaths(
  binding: Binding,
  state: ScriptState,
  seenAliases: Set<Binding> = new Set([binding])
): Set<string> {
  const cached = state.mutationGTContainerPaths.get(binding);
  if (cached) return new Set(cached);
  if (state.mutationGTContainerPathsInProgress.has(binding)) return new Set();
  state.mutationGTContainerPathsInProgress.add(binding);
  const result = new Set<string>();
  const writePolicy = readBindingContainerWritePolicy(binding, state);
  const blocksWriteAtDepth = (depth: number): boolean =>
    writePolicy === 'readonly-deep' ||
    (writePolicy === 'readonly-shallow' && depth <= 1);
  const appendProperties = (properties: string[]): string =>
    properties.reduce(appendTemplatePath, binding.identifier.name);
  const collectAssignedContainer = (
    value: t.Node,
    scope: Scope,
    properties: string[]
  ): void => {
    for (const path of collectPossibleGTContainerPaths(
      value,
      scope,
      appendProperties(properties),
      state,
      new Set(),
      new Set([binding])
    )) {
      result.add(path);
    }
  };

  for (const reference of binding.referencePaths) {
    let current: NodePath<t.Node> = reference;
    const properties: string[] = [];
    while (
      current.parentPath &&
      (current.parentPath.isMemberExpression() ||
        current.parentPath.isOptionalMemberExpression()) &&
      current.parentPath.node.object === current.node
    ) {
      const property = readResolvedMemberProperty(
        current.parentPath.node,
        current.parentPath.scope,
        state
      );
      if (property === undefined) properties.push(unknownTemplatePathSegment);
      else properties.push(property);
      current = current.parentPath;
    }
    const parent = current.parentPath;
    if (parent?.isAssignmentExpression() && parent.node.left === current.node) {
      const target =
        properties[0] === 'value' ? properties.slice(1) : properties;
      if (blocksWriteAtDepth(target.length)) continue;
      if (
        target.length > 0 &&
        expressionMayProduceComponent(
          parent.node.right,
          parent.scope,
          state,
          new Set([binding]),
          'T'
        )
      ) {
        result.add(appendProperties(target.slice(0, -1)));
      }
      collectAssignedContainer(parent.node.right, parent.scope, target);
      continue;
    }
    if (!parent?.isCallExpression()) continue;
    if (parent.node.callee !== current.node) {
      const callee = readResolvedMemberPath(
        parent.node.callee,
        parent.scope,
        state
      );
      const argumentIndex = parent.node.arguments.findIndex(
        (argument) => argument === reference.node
      );
      if (callee === 'Object.assign' && argumentIndex === 0) {
        if (blocksWriteAtDepth(1)) continue;
        for (const source of parent.node.arguments.slice(1)) {
          if (source.type === 'ArgumentPlaceholder') continue;
          collectAssignedContainer(
            source.type === 'SpreadElement' ? source.argument : source,
            parent.scope,
            []
          );
        }
      } else if (callee === 'Reflect.set' && argumentIndex === 0) {
        if (blocksWriteAtDepth(1)) continue;
        const key = parent.node.arguments[1];
        const value = parent.node.arguments[2];
        if (
          value &&
          value.type !== 'ArgumentPlaceholder' &&
          value.type !== 'SpreadElement'
        ) {
          const staticKey =
            key &&
            key.type !== 'ArgumentPlaceholder' &&
            key.type !== 'SpreadElement'
              ? readStaticFromScope(
                  key,
                  parent.scope,
                  new Set(),
                  key.end ?? Number.POSITIVE_INFINITY,
                  state.analysis
                )
              : undefined;
          const property =
            staticKey?.ok &&
            (typeof staticKey.value === 'string' ||
              typeof staticKey.value === 'number')
              ? String(staticKey.value)
              : unknownTemplatePathSegment;
          if (
            expressionMayProduceComponent(
              value,
              parent.scope,
              state,
              new Set([binding]),
              'T'
            )
          ) {
            result.add(binding.identifier.name);
          }
          collectAssignedContainer(value, parent.scope, [property]);
        }
      }
      continue;
    }
    const method = properties.at(-1);
    const target = properties
      .slice(0, -1)
      .filter((property, index) => !(index === 0 && property === 'value'));
    if (blocksWriteAtDepth(target.length + 1)) continue;
    const argumentsToCheck =
      method === 'splice'
        ? parent.node.arguments.slice(2)
        : method === 'fill'
          ? parent.node.arguments.slice(0, 1)
          : method === 'push' || method === 'unshift'
            ? parent.node.arguments
            : [];
    for (const argument of argumentsToCheck) {
      if (argument.type === 'ArgumentPlaceholder') continue;
      const value =
        argument.type === 'SpreadElement' ? argument.argument : argument;
      if (
        expressionMayProduceComponent(
          value,
          parent.scope,
          state,
          new Set([binding]),
          'T'
        )
      ) {
        result.add(appendProperties(target));
      }
      collectAssignedContainer(value, parent.scope, [
        ...target,
        unknownTemplatePathSegment,
      ]);
    }
  }
  for (const reference of binding.referencePaths) {
    const declarator = reference.parentPath;
    if (
      !declarator?.isVariableDeclarator() ||
      declarator.node.init !== reference.node ||
      declarator.node.id.type !== 'Identifier'
    ) {
      continue;
    }
    const alias = declarator.scope.getBinding(declarator.node.id.name);
    if (!alias || seenAliases.has(alias)) continue;
    const aliasPaths = bindingMutationGTContainerPaths(
      alias,
      state,
      new Set(seenAliases).add(alias)
    );
    for (const path of aliasPaths) {
      result.add(
        path === alias.identifier.name
          ? binding.identifier.name
          : `${binding.identifier.name}${path.slice(alias.identifier.name.length)}`
      );
    }
  }
  state.mutationGTContainerPaths.set(binding, new Set(result));
  state.mutationGTContainerPathsInProgress.delete(binding);
  return result;
}

/** Detects a component alias whose value escaped the safe static subset. */
function bindingMayReferenceComponent(
  binding: Binding,
  state: ScriptState,
  kind?: ComponentKind
): boolean {
  const cacheKey = kind ?? 'any';
  const cached =
    state.parameterSubstitutions.length === 0
      ? state.componentPossibilities.get(binding)?.get(cacheKey)
      : undefined;
  if (cached !== undefined) return cached;
  const declaration = binding.path.node;
  const result =
    declaration.type === 'VariableDeclarator' &&
    declaration.init &&
    patternMayProduceComponent(
      declaration.id,
      declaration.init,
      binding.identifier.name,
      binding.path.scope,
      state,
      new Set([binding]),
      kind
    )
      ? true
      : binding.constantViolations.some((violation) =>
          constantViolationMayAssignComponent(
            violation,
            binding.identifier.name,
            state,
            new Set([binding]),
            kind
          )
        );
  if (state.parameterSubstitutions.length === 0) {
    const possibilities =
      state.componentPossibilities.get(binding) ??
      new Map<ComponentKind | 'any', boolean>();
    possibilities.set(cacheKey, result);
    state.componentPossibilities.set(binding, possibilities);
  }
  return result;
}

/**
 * Proves a const direct-alias chain cannot itself be a string translator.
 *
 * Container contents may still mutate, but an array or object never becomes
 * callable. Caching only this positive proof avoids memoizing an unresolved
 * false result that could depend on cross-block or callback analysis.
 */
function bindingIsDefinitelyNotStringFunction(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  if (state.definiteNonStringFunctionBindings.has(binding)) return true;
  if (
    !binding.constant ||
    seen.has(binding) ||
    state.parameterSubstitutions.length > 0 ||
    state.definiteNonStringFunctionBindingsInProgress.has(binding)
  ) {
    return false;
  }
  const source = getBindingSource(binding);
  if (source?.pattern.type !== 'Identifier') return false;
  const expression = unwrapExpression(source.expression.node);
  if (!expression) return false;

  state.definiteNonStringFunctionBindingsInProgress.add(binding);
  try {
    const known = resolveKnownExpression(
      expression,
      source.expression.scope,
      state,
      new Set([binding])
    );
    let result = Boolean(known && known.type !== 'string');
    if (!known && expression.type === 'Identifier') {
      const target = source.expression.scope.getBinding(expression.name);
      result = Boolean(
        target &&
        bindingIsDefinitelyNotStringFunction(
          target,
          state,
          new Set(seen).add(binding)
        )
      );
    } else if (
      !known &&
      (expression.type === 'ArrayExpression' ||
        expression.type === 'ObjectExpression')
    ) {
      result = true;
    }
    if (result) state.definiteNonStringFunctionBindings.add(binding);
    return result;
  } finally {
    state.definiteNonStringFunctionBindingsInProgress.delete(binding);
  }
}

/** Detects a string translator alias whose value escaped exact analysis. */
function bindingMayReferenceStringFunction(
  binding: Binding,
  state: ScriptState
): boolean {
  if (bindingIsDefinitelyNotStringFunction(binding, state, new Set())) {
    return false;
  }
  const finalAssignment = readDefiniteFinalBindingAssignment(binding);
  if (finalAssignment) {
    return expressionMayProduceStringFunction(
      finalAssignment.node,
      finalAssignment.scope,
      state,
      new Set([binding])
    );
  }
  const declaration = binding.path.node;
  if (
    declaration.type === 'VariableDeclarator' &&
    declaration.init &&
    patternMayProduceStringFunction(
      declaration.id,
      declaration.init,
      binding.identifier.name,
      binding.path.scope,
      state,
      new Set([binding])
    )
  ) {
    return true;
  }
  return binding.constantViolations.some(
    (violation) =>
      violation.isAssignmentExpression() &&
      patternContains(violation.node.left, binding.identifier.name) &&
      expressionMayProduceStringFunction(
        violation.node.right,
        violation.scope,
        state,
        new Set([binding])
      )
  );
}

/** Tracks expressions whose resulting value can be a gt-vue string function. */
function expressionMayProduceStringFunction(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  if (state.analysis.stats) state.analysis.stats.stringFunctionVisits += 1;
  const expression = unwrapExpression(node);
  if (!expression) return false;
  const resolved = resolveKnownExpression(expression, scope, state, new Set());
  if (resolved?.type === 'string') return true;
  const exposedPath = readExposedMemberPath(expression, scope, state);
  if (exposedPath && state.analysis.uncertainStringFunctions.has(exposedPath)) {
    return true;
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      return state.analysis.uncertainStringFunctions.has(expression.name);
    }
    const substitution = readParameterSubstitution(binding, state);
    if (substitution) {
      return expressionMayProduceStringFunction(
        substitution.node,
        substitution.scope,
        state,
        seen
      );
    }
    if (bindingIsDefinitelyNotStringFunction(binding, state, seen)) {
      return false;
    }
    if (seen.has(binding)) return false;
    const nextSeen = new Set(seen).add(binding);
    const declaration = binding.path.node;
    if (
      declaration.type === 'VariableDeclarator' &&
      declaration.init &&
      patternMayProduceStringFunction(
        declaration.id,
        declaration.init,
        binding.identifier.name,
        binding.path.scope,
        state,
        nextSeen
      )
    ) {
      return true;
    }
    return binding.constantViolations.some(
      (violation) =>
        violation.isAssignmentExpression() &&
        patternContains(violation.node.left, binding.identifier.name) &&
        expressionMayProduceStringFunction(
          violation.node.right,
          violation.scope,
          state,
          nextSeen
        )
    );
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const property = readResolvedMemberProperty(expression, scope, state);
    if (!property) {
      return containerMayContainStringFunction(
        expression.object,
        scope,
        state,
        new Set()
      );
    }
    const entry = readObjectEntry(
      expression.object,
      property,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state
    );
    if (entry.status === 'known') {
      return expressionMayProduceStringFunction(
        entry.expression.node,
        entry.expression.scope,
        state,
        seen
      );
    }
    if (
      objectGetterMayProduceStringFunction(
        expression.object,
        property,
        scope,
        state,
        seen
      )
    ) {
      return true;
    }
    const namespaceMember = knownExport('gt-vue', property);
    return Boolean(
      (namespaceMember?.type === 'string' ||
        namespaceMember?.type === 'hook') &&
      expressionMayCopyGTNamespaceExport(
        expression.object,
        property,
        scope,
        state
      )
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      new Set()
    );
    const firstArgument = expression.arguments[0];
    const first =
      firstArgument &&
      firstArgument.type !== 'ArgumentPlaceholder' &&
      firstArgument.type !== 'SpreadElement'
        ? firstArgument
        : undefined;
    if (callee?.type === 'vue-wrapper') {
      return callee.kind === 'computed'
        ? computedSourceMayProduceStringFunction(first, scope, state, seen)
        : expressionMayProduceStringFunction(first, scope, state, seen);
    }
    const called = resolveCalledFunction(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (called) {
      const mayReturnStringFunction = withCallParameterSubstitutions(
        expression,
        called,
        scope,
        state,
        () =>
          functionMayReturnStringFunction(
            called.node,
            called.scope,
            state,
            seen
          )
      );
      if (mayReturnStringFunction) return true;
    }
    return expression.arguments.some(
      (argument) =>
        argument.type !== 'ArgumentPlaceholder' &&
        (expressionMayProduceStringFunction(
          argument.type === 'SpreadElement' ? argument.argument : argument,
          scope,
          state,
          seen
        ) ||
          containerMayContainStringFunction(
            argument.type === 'SpreadElement' ? argument.argument : argument,
            scope,
            state,
            new Set()
          ))
    );
  }
  if (expression.type === 'ConditionalExpression') {
    const condition = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (condition.ok) {
      return expressionMayProduceStringFunction(
        condition.value ? expression.consequent : expression.alternate,
        scope,
        state,
        seen
      );
    }
    return (
      expressionMayProduceStringFunction(
        expression.consequent,
        scope,
        state,
        seen
      ) ||
      expressionMayProduceStringFunction(
        expression.alternate,
        scope,
        state,
        seen
      )
    );
  }
  if (expression.type === 'LogicalExpression') {
    return (
      expressionMayProduceStringFunction(expression.left, scope, state, seen) ||
      expressionMayProduceStringFunction(expression.right, scope, state, seen)
    );
  }
  if (expression.type === 'SequenceExpression') {
    return expressionMayProduceStringFunction(
      expression.expressions.at(-1),
      scope,
      state,
      seen
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMayProduceStringFunction(
      expression.right,
      scope,
      state,
      seen
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expressionMayProduceStringFunction(
      expression.argument,
      scope,
      state,
      seen
    );
  }
  return false;
}

/** Tracks a destructured string-function value, including rest bindings. */
function patternMayProduceStringFunction(
  pattern: t.Node,
  valueNode: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  const exposedBase = readExposedMemberPath(valueNode, scope, state);
  const exposedPath = exposedBase
    ? readPatternExposedMemberPath(
        pattern,
        targetName,
        exposedBase,
        scope,
        state
      )
    : undefined;
  if (
    exposedPath &&
    (state.analysis.values.get(exposedPath)?.type === 'string' ||
      state.analysis.uncertainStringFunctions.has(exposedPath))
  ) {
    return true;
  }
  if (pattern.type === 'Identifier') {
    return (
      pattern.name === targetName &&
      expressionMayProduceStringFunction(valueNode, scope, state, seen)
    );
  }
  if (pattern.type === 'RestElement') {
    return false;
  }
  if (pattern.type === 'AssignmentPattern') {
    return (
      patternContains(pattern.left, targetName) &&
      (expressionMayProduceStringFunction(valueNode, scope, state, seen) ||
        (expressionMayBeUndefined(valueNode, scope, state, new Set()) &&
          expressionMayProduceStringFunction(
            pattern.right,
            scope,
            state,
            seen
          )))
    );
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      const containsTarget =
        property.type === 'RestElement'
          ? patternContains(property.argument, targetName)
          : patternContains(property.value, targetName);
      if (!containsTarget) continue;
      if (property.type === 'RestElement') {
        return false;
      }
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) return true;
      const entry = readObjectEntry(
        valueNode,
        key,
        scope,
        new Set(),
        valueNode.end ?? Number.POSITIVE_INFINITY,
        state
      );
      return entry.status === 'known'
        ? patternMayProduceStringFunction(
            property.value,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            state,
            seen
          )
        : objectGetterMayProduceStringFunction(
            valueNode,
            key,
            scope,
            state,
            seen
          ) ||
            expressionMayProduceStringFunction(
              property.value.type === 'AssignmentPattern'
                ? property.value.right
                : undefined,
              scope,
              state,
              seen
            );
    }
    return false;
  }
  if (pattern.type === 'ArrayPattern') {
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      if (target.type === 'RestElement') {
        return false;
      }
      const entry = readArrayEntry(
        valueNode,
        index,
        scope,
        new Set(),
        valueNode.end ?? Number.POSITIVE_INFINITY,
        state
      );
      return entry.status === 'known'
        ? patternMayProduceStringFunction(
            target,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            state,
            seen
          )
        : target.type === 'AssignmentPattern' &&
            expressionMayProduceStringFunction(
              target.right,
              scope,
              state,
              seen
            );
    }
  }
  return false;
}

/** Finds string-function values nested in data containers. */
function containerMayContainStringFunction(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): boolean {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return false;
  const known = resolveKnownExpression(expression, scope, state, new Set());
  if (known?.type === 'namespace' && known.source === 'gt-vue') return true;
  const nextSeen = new Set(seen).add(expression);
  if (expression.type === 'ObjectExpression') {
    return expression.properties.some((property) => {
      if (property.type === 'SpreadElement') {
        return containerMayContainStringFunction(
          property.argument,
          scope,
          state,
          nextSeen
        );
      }
      if (property.type === 'ObjectMethod') {
        return (
          property.kind === 'get' &&
          functionMayReturnStringFunction(property, scope, state, new Set())
        );
      }
      return (
        expressionMayProduceStringFunction(
          property.value,
          scope,
          state,
          new Set()
        ) ||
        containerMayContainStringFunction(
          property.value,
          scope,
          state,
          nextSeen
        )
      );
    });
  }
  if (expression.type === 'ArrayExpression') {
    return expression.elements.some((element) => {
      if (!element) return false;
      const value =
        element.type === 'SpreadElement' ? element.argument : element;
      return (
        expressionMayProduceStringFunction(value, scope, state, new Set()) ||
        containerMayContainStringFunction(value, scope, state, nextSeen)
      );
    });
  }
  return false;
}

/** Detects a named export copied from the gt-vue namespace by rest or spread. */
function expressionMayCopyGTNamespaceExport(
  node: t.Node,
  property: string,
  scope: Scope,
  state: ScriptState
): boolean {
  const expression = unwrapExpression(node);
  if (expression?.type === 'ObjectExpression') {
    return expression.properties.some(
      (entry) =>
        entry.type === 'SpreadElement' &&
        resolveNamespaceOrigin(entry.argument, scope, state, new Set())
          ?.source === 'gt-vue'
    );
  }
  if (expression?.type !== 'Identifier') return false;
  const binding = scope.getBinding(expression.name);
  if (!binding) return false;
  const declaration = binding.path.node;
  if (declaration?.type !== 'VariableDeclarator' || !declaration.init) {
    return false;
  }
  const rest = readDirectRestPattern(
    declaration.id,
    expression.name,
    binding.path.scope,
    state
  );
  return Boolean(
    rest?.type === 'object' &&
    !rest.excluded.has(property) &&
    resolveNamespaceOrigin(
      declaration.init,
      binding.path.scope,
      state,
      new Set()
    )?.source === 'gt-vue'
  );
}

/** Tracks assignment and for-of writes into one top-level component alias. */
function constantViolationMayAssignComponent(
  violation: NodePath<t.Node>,
  targetName: string,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  if (
    violation.isAssignmentExpression() &&
    patternContains(violation.node.left, targetName)
  ) {
    return expressionMayProduceComponent(
      violation.node.right,
      violation.scope,
      state,
      seen,
      kind
    );
  }
  if (
    violation.isForOfStatement() &&
    patternContains(violation.node.left, targetName)
  ) {
    return (
      expressionMayProduceComponent(
        violation.node.right,
        violation.scope,
        state,
        seen,
        kind
      ) ||
      containerMayContainComponent(
        violation.node.right,
        violation.scope,
        state,
        new Set(),
        kind
      )
    );
  }
  return false;
}

/** Tracks expressions whose resulting identity can be a GT/Vue component. */
function expressionMayProduceComponent(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const expression = unwrapExpression(node);
  if (!expression) return false;
  const resolved = resolveKnownExpression(expression, scope, state, new Set());
  if (resolved?.type === 'component') {
    return kind !== 'vue' && (kind !== 'T' || resolved.name === 'T');
  }
  if (resolved?.type === 'vue-builtin') {
    return kind !== 'translation' && kind !== 'T';
  }
  const exposedPath = readExposedMemberPath(expression, scope, state);
  if (
    exposedPath &&
    (kind === 'translation' || kind === 'T'
      ? state.analysis.uncertainGTComponents.has(exposedPath)
      : state.analysis.uncertainComponents.has(exposedPath))
  ) {
    return true;
  }
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) {
      return kind === 'translation' || kind === 'T'
        ? state.analysis.uncertainGTComponents.has(expression.name)
        : state.analysis.uncertainComponents.has(expression.name);
    }
    const substitution = readParameterSubstitution(binding, state);
    if (substitution) {
      return expressionMayProduceComponent(
        substitution.node,
        substitution.scope,
        state,
        seen,
        kind
      );
    }
    const cacheKey = kind ?? 'any';
    if (state.parameterSubstitutions.length === 0) {
      const cached = state.componentPossibilities.get(binding)?.get(cacheKey);
      if (cached !== undefined) return cached;
    }
    if (seen.has(binding)) return false;
    const nextSeen = new Set(seen).add(binding);
    const declaration = binding.path.node;
    const result =
      declaration.type === 'VariableDeclarator' &&
      !!declaration.init &&
      patternMayProduceComponent(
        declaration.id,
        declaration.init,
        binding.identifier.name,
        binding.path.scope,
        state,
        nextSeen,
        kind
      )
        ? true
        : bindingIterationMayProduceComponent(binding, state, nextSeen, kind)
          ? true
          : binding.constantViolations.some((violation) =>
              constantViolationMayAssignComponent(
                violation,
                binding.identifier.name,
                state,
                nextSeen,
                kind
              )
            );
    if (state.parameterSubstitutions.length === 0) {
      const possibilities =
        state.componentPossibilities.get(binding) ??
        new Map<ComponentKind | 'any', boolean>();
      possibilities.set(cacheKey, result);
      state.componentPossibilities.set(binding, possibilities);
    }
    return result;
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const property = readResolvedMemberProperty(expression, scope, state);
    const namespace = resolveNamespaceOrigin(
      expression.object,
      scope,
      state,
      new Set()
    );
    const member =
      namespace && property
        ? knownExport(namespace.source, property)
        : undefined;
    if (member?.type === 'component') {
      return kind !== 'vue' && (kind !== 'T' || member.name === 'T');
    }
    if (member?.type === 'vue-builtin') {
      return kind !== 'translation' && kind !== 'T';
    }
    const arrayIndex = property?.match(/^(0|[1-9]\d*)$/)
      ? Number(property)
      : undefined;
    if (
      arrayIndex !== undefined &&
      arrayElementMayProduceComponent(
        expression.object,
        arrayIndex,
        scope,
        state,
        seen,
        kind
      )
    ) {
      return true;
    }
    return Boolean(
      property &&
      objectPropertyMayProduceComponent(
        expression.object,
        property,
        scope,
        state,
        seen,
        kind
      )
    );
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = resolveKnownExpression(
      expression.callee,
      scope,
      state,
      new Set()
    );
    const firstArgument = expression.arguments[0];
    const first =
      firstArgument &&
      firstArgument.type !== 'ArgumentPlaceholder' &&
      firstArgument.type !== 'SpreadElement'
        ? firstArgument
        : undefined;
    if (callee?.type === 'identity' || callee?.type === 'defineComponent') {
      return expressionMayProduceComponent(first, scope, state, seen, kind);
    }
    if (callee?.type === 'vue-wrapper') {
      return callee.kind === 'computed'
        ? computedSourceMayProduceComponent(first, scope, state, seen, kind)
        : expressionMayProduceComponent(first, scope, state, seen, kind);
    }
    const calledFunction = resolveCalledFunction(
      expression.callee,
      scope,
      state,
      new Set()
    );
    if (calledFunction) {
      const mayReturnComponent = withCallParameterSubstitutions(
        expression,
        calledFunction,
        scope,
        state,
        () =>
          functionMayReturnComponent(
            calledFunction.node,
            calledFunction.scope,
            state,
            seen,
            kind
          )
      );
      if (mayReturnComponent) return true;
    }
    const memberCallee = unwrapExpression(expression.callee);
    if (
      memberCallee &&
      (memberCallee.type === 'MemberExpression' ||
        memberCallee.type === 'OptionalMemberExpression') &&
      ['reduce', 'reduceRight'].includes(
        readResolvedMemberProperty(memberCallee, scope, state) ?? ''
      )
    ) {
      const reduced = reduceCallMayProduceComponent(
        expression,
        memberCallee,
        scope,
        state,
        seen,
        kind
      );
      if (reduced !== undefined) return reduced;
    }
    return expression.arguments.some(
      (argument) =>
        argument.type !== 'ArgumentPlaceholder' &&
        expressionMayProduceComponent(
          argument.type === 'SpreadElement' ? argument.argument : argument,
          scope,
          state,
          seen,
          kind
        )
    );
  }
  if (expression.type === 'ConditionalExpression') {
    const condition = readStaticFromScope(
      expression.test,
      scope,
      new Set(),
      expression.test.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (condition.ok) {
      return expressionMayProduceComponent(
        condition.value ? expression.consequent : expression.alternate,
        scope,
        state,
        seen,
        kind
      );
    }
    return (
      expressionMayProduceComponent(
        expression.consequent,
        scope,
        state,
        seen,
        kind
      ) ||
      expressionMayProduceComponent(
        expression.alternate,
        scope,
        state,
        seen,
        kind
      )
    );
  }
  if (expression.type === 'LogicalExpression') {
    const left = resolveKnownExpression(
      expression.left,
      scope,
      state,
      new Set()
    );
    if (left) {
      return expression.operator === '&&'
        ? expressionMayProduceComponent(
            expression.right,
            scope,
            state,
            seen,
            kind
          )
        : left.type === 'component'
          ? kind !== 'vue' && (kind !== 'T' || left.name === 'T')
          : left.type === 'vue-builtin' &&
            kind !== 'translation' &&
            kind !== 'T';
    }
    const staticLeft = readStaticFromScope(
      expression.left,
      scope,
      new Set(),
      expression.left.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (staticLeft.ok) {
      const selectsRight =
        expression.operator === '??'
          ? staticLeft.value == null
          : expression.operator === '||'
            ? !staticLeft.value
            : Boolean(staticLeft.value);
      return selectsRight
        ? expressionMayProduceComponent(
            expression.right,
            scope,
            state,
            seen,
            kind
          )
        : false;
    }
    return (
      expressionMayProduceComponent(
        expression.left,
        scope,
        state,
        seen,
        kind
      ) ||
      expressionMayProduceComponent(expression.right, scope, state, seen, kind)
    );
  }
  if (expression.type === 'SequenceExpression') {
    return expressionMayProduceComponent(
      expression.expressions.at(-1),
      scope,
      state,
      seen,
      kind
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMayProduceComponent(
      expression.right,
      scope,
      state,
      seen,
      kind
    );
  }
  if (
    expression.type === 'AwaitExpression' ||
    expression.type === 'YieldExpression'
  ) {
    return expressionMayProduceComponent(
      expression.argument,
      scope,
      state,
      seen,
      kind
    );
  }
  return false;
}

/** Models finite reduce calls whose callback invocation order is knowable. */
function reduceCallMayProduceComponent(
  call: t.CallExpression | t.OptionalCallExpression,
  callee: t.MemberExpression | t.OptionalMemberExpression,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean | undefined {
  const method = readResolvedMemberProperty(callee, scope, state);
  if (method !== 'reduce' && method !== 'reduceRight') return undefined;
  const callbackNode = call.arguments[0];
  if (
    !callbackNode ||
    callbackNode.type === 'ArgumentPlaceholder' ||
    callbackNode.type === 'SpreadElement'
  ) {
    return undefined;
  }
  const callback = resolveCalledFunction(callbackNode, scope, state, new Set());
  const entries = collectTransformArrayEntries(
    callee.object,
    scope,
    state,
    new Set()
  );
  if (!callback || !entries || entries.some((entry) => !entry)) {
    return undefined;
  }
  const ordered = entries.map((entry, index) => ({ entry: entry!, index }));
  if (method === 'reduceRight') ordered.reverse();
  const initialArgument = call.arguments[1];
  const initial =
    initialArgument &&
    initialArgument.type !== 'ArgumentPlaceholder' &&
    initialArgument.type !== 'SpreadElement'
      ? { node: initialArgument, scope }
      : ordered.shift()?.entry;
  if (!initial) return false;
  if (ordered.length === 0) {
    return expressionMayProduceComponent(
      initial.node,
      initial.scope,
      state,
      seen,
      kind
    );
  }
  const finalValue = ordered.at(-1)!;
  const source = { node: callee.object, scope };
  const invoke = (accumulator: ScopedExpression): boolean =>
    withFunctionParameterSubstitutions(
      callback,
      [
        accumulator,
        finalValue.entry,
        {
          node: {
            type: 'NumericLiteral',
            value: finalValue.index,
          } as t.NumericLiteral,
          scope,
        },
        source,
      ],
      state,
      () =>
        functionMayReturnComponent(
          callback.node,
          callback.scope,
          state,
          seen,
          kind
        )
    );
  if (ordered.length === 1) return invoke(initial);
  if (functionMayReturnParameter(callback.node, callback.scope, 1, state)) {
    return expressionMayProduceComponent(
      finalValue.entry.node,
      finalValue.entry.scope,
      state,
      seen,
      kind
    );
  }
  if (functionMayReturnParameter(callback.node, callback.scope, 0, state)) {
    return expressionMayProduceComponent(
      initial.node,
      initial.scope,
      state,
      seen,
      kind
    );
  }
  return invoke(initial);
}

/** Tracks a lexical variable populated from a for-of iterable. */
function bindingIterationMayProduceComponent(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    declaration.init ||
    !patternContains(declaration.id, binding.identifier.name)
  ) {
    return false;
  }
  const declarationPath = state.paths.get(declaration);
  const loop = declarationPath?.parentPath?.parentPath;
  if (!loop?.isForOfStatement()) return false;
  return (
    expressionMayProduceComponent(
      loop.node.right,
      loop.scope,
      state,
      seen,
      kind
    ) ||
    containerMayContainComponent(
      loop.node.right,
      loop.scope,
      state,
      new Set(),
      kind
    )
  );
}

/** Finds component identities nested in a data container, not function bodies. */
function containerMayContainComponent(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>,
  kind?: ComponentKind
): boolean {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return false;
  const nextSeen = new Set(seen).add(expression);
  if (expression.type === 'ObjectExpression') {
    return expression.properties.some((property) => {
      if (property.type === 'SpreadElement') {
        return containerMayContainComponent(
          property.argument,
          scope,
          state,
          nextSeen,
          kind
        );
      }
      if (property.type === 'ObjectMethod') {
        return (
          property.kind === 'get' &&
          functionMayReturnComponent(property, scope, state, new Set(), kind)
        );
      }
      return (
        expressionMayProduceComponent(
          property.value,
          scope,
          state,
          new Set(),
          kind
        ) ||
        containerMayContainComponent(
          property.value,
          scope,
          state,
          nextSeen,
          kind
        )
      );
    });
  }
  if (expression.type === 'ArrayExpression') {
    return expression.elements.some((element) => {
      if (!element) return false;
      const value =
        element.type === 'SpreadElement' ? element.argument : element;
      return (
        expressionMayProduceComponent(value, scope, state, new Set(), kind) ||
        containerMayContainComponent(value, scope, state, nextSeen, kind)
      );
    });
  }
  return false;
}

/** Tracks one array element without treating sibling values as identity. */
function arrayElementMayProduceComponent(
  node: t.Node,
  index: number,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const expression = unwrapExpression(node);
  const entry = readArrayEntry(
    node,
    index,
    scope,
    new Set(),
    expression?.end ?? Number.POSITIVE_INFINITY,
    state
  );
  if (entry.status === 'known') {
    return expressionMayProduceComponent(
      entry.expression.node,
      entry.expression.scope,
      state,
      seen,
      kind
    );
  }
  return findArrayElementOrigins(node, index, scope, new Set(), new Set()).some(
    (origin) =>
      expressionMayProduceComponent(
        origin.node,
        origin.scope,
        state,
        seen,
        kind
      )
  );
}

/** Finds an array initializer even when its retained container later escapes. */
function findArrayElementOrigins(
  node: t.Node,
  index: number,
  scope: Scope,
  seenBindings: Set<Binding>,
  seenNodes: Set<t.Node>
): ScopedExpression[] {
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return [];
  const nextNodes = new Set(seenNodes).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding || seenBindings.has(binding)) return [];
    const declaration = binding.path.node;
    return declaration.type === 'VariableDeclarator' && declaration.init
      ? findArrayElementOrigins(
          declaration.init,
          index,
          binding.path.scope,
          new Set(seenBindings).add(binding),
          nextNodes
        )
      : [];
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const member = readMemberProperty(expression);
    const memberIndex = member?.match(/^(0|[1-9]\d*)$/)
      ? Number(member)
      : undefined;
    if (memberIndex === undefined) return [];
    return findArrayElementOrigins(
      expression.object,
      memberIndex,
      scope,
      seenBindings,
      nextNodes
    ).flatMap((origin) =>
      findArrayElementOrigins(
        origin.node,
        index,
        origin.scope,
        seenBindings,
        nextNodes
      )
    );
  }
  if (expression.type !== 'ArrayExpression') return [];
  const element = expression.elements[index];
  return element && element.type !== 'SpreadElement'
    ? [{ node: element, scope }]
    : [];
}

/** Tracks a destructured value without treating sibling object data as identity. */
function patternMayProduceComponent(
  pattern: t.Node,
  valueNode: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const exposedBase = readExposedMemberPath(valueNode, scope, state);
  const exposedPath = exposedBase
    ? readPatternExposedMemberPath(
        pattern,
        targetName,
        exposedBase,
        scope,
        state
      )
    : undefined;
  const exposed = exposedPath
    ? state.analysis.values.get(exposedPath)
    : undefined;
  if (exposed?.type === 'component') {
    return kind !== 'vue' && (kind !== 'T' || exposed.name === 'T');
  }
  if (exposed?.type === 'vue-builtin') {
    return kind !== 'translation' && kind !== 'T';
  }
  if (
    exposedPath &&
    (kind === 'translation' || kind === 'T'
      ? state.analysis.uncertainGTComponents.has(exposedPath)
      : state.analysis.uncertainComponents.has(exposedPath))
  ) {
    return true;
  }
  if (pattern.type === 'Identifier') {
    return (
      pattern.name === targetName &&
      expressionMayProduceComponent(valueNode, scope, state, seen, kind)
    );
  }
  if (pattern.type === 'RestElement') {
    return false;
  }
  if (pattern.type === 'AssignmentPattern') {
    return patternContains(pattern.left, targetName)
      ? expressionMayProduceComponent(valueNode, scope, state, seen, kind) ||
          (expressionMayBeUndefined(valueNode, scope, state, new Set()) &&
            expressionMayProduceComponent(
              pattern.right,
              scope,
              state,
              seen,
              kind
            ))
      : false;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (
        property.type === 'RestElement' &&
        patternContains(property.argument, targetName)
      ) {
        return false;
      }
      if (
        property.type !== 'ObjectProperty' ||
        !patternContains(property.value, targetName)
      ) {
        continue;
      }
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) {
        return patternDefaultMayProduceComponent(
          property.value,
          targetName,
          scope,
          state,
          seen,
          kind
        );
      }
      const namespace = resolveNamespaceOrigin(
        valueNode,
        scope,
        state,
        new Set()
      );
      const exported = namespace
        ? knownExport(namespace.source, key)
        : undefined;
      if (
        exported?.type === 'component' &&
        kind !== 'vue' &&
        (kind !== 'T' || exported.name === 'T')
      ) {
        return true;
      }
      if (
        exported?.type === 'vue-builtin' &&
        kind !== 'translation' &&
        kind !== 'T'
      )
        return true;
      const entry = readObjectEntry(
        valueNode,
        key,
        scope,
        new Set(),
        valueNode.end ?? Number.POSITIVE_INFINITY,
        state
      );
      if (entry.status === 'known') {
        return patternMayProduceComponent(
          property.value,
          entry.expression.node,
          targetName,
          entry.expression.scope,
          state,
          seen,
          kind
        );
      }
      if (
        findObjectPropertyOrigins(
          valueNode,
          key,
          scope,
          new Set(),
          new Set(),
          state
        ).some((origin) =>
          patternMayProduceComponent(
            property.value,
            origin.node,
            targetName,
            origin.scope,
            state,
            seen,
            kind
          )
        )
      ) {
        return true;
      }
      return (
        objectGetterMayProduceComponent(
          valueNode,
          key,
          scope,
          state,
          seen,
          kind
        ) ||
        patternDefaultMayProduceComponent(
          property.value,
          targetName,
          scope,
          state,
          seen,
          kind
        )
      );
    }
    return false;
  }
  if (pattern.type === 'ArrayPattern') {
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      if (target.type === 'RestElement') {
        return false;
      }
      const entry = readArrayEntry(
        valueNode,
        index,
        scope,
        new Set(),
        valueNode.end ?? Number.POSITIVE_INFINITY,
        state
      );
      if (entry.status === 'known') {
        return patternMayProduceComponent(
          target,
          entry.expression.node,
          targetName,
          entry.expression.scope,
          state,
          seen,
          kind
        );
      }
      return (
        findArrayElementOrigins(
          valueNode,
          index,
          scope,
          new Set(),
          new Set()
        ).some((origin) =>
          patternMayProduceComponent(
            target,
            origin.node,
            targetName,
            origin.scope,
            state,
            seen,
            kind
          )
        ) ||
        patternDefaultMayProduceComponent(
          target,
          targetName,
          scope,
          state,
          seen,
          kind
        )
      );
    }
  }
  return false;
}

/** Tracks a destructuring default when the selected source value is unknown. */
function patternDefaultMayProduceComponent(
  pattern: t.Node,
  targetName: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  if (pattern.type === 'AssignmentPattern') {
    return (
      patternContains(pattern.left, targetName) &&
      expressionMayProduceComponent(pattern.right, scope, state, seen, kind)
    );
  }
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.some(
      (property) =>
        property.type === 'ObjectProperty' &&
        patternContains(property.value, targetName) &&
        patternDefaultMayProduceComponent(
          property.value,
          targetName,
          scope,
          state,
          seen,
          kind
        )
    );
  }
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.some(
      (element) =>
        !!element &&
        patternContains(element, targetName) &&
        patternDefaultMayProduceComponent(
          element,
          targetName,
          scope,
          state,
          seen,
          kind
        )
    );
  }
  return false;
}

/** Finds a namespace's source even when mutation makes its value untrusted. */
function resolveNamespaceOrigin(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): Extract<KnownValue, { type: 'namespace' }> | undefined {
  const expression = unwrapExpression(node);
  if (!expression) return undefined;
  const required = readRequireNamespace(expression, scope);
  if (required) return required;
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  if (!binding) {
    const value = state.analysis.values.get(expression.name);
    return value?.type === 'namespace' ? value : undefined;
  }
  if (seen.has(binding)) return undefined;
  const existing = state.bindings.get(binding);
  if (existing?.type === 'namespace') return existing;
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    declaration.id.type !== 'Identifier' ||
    !declaration.init
  ) {
    return undefined;
  }
  return resolveNamespaceOrigin(
    declaration.init,
    binding.path.scope,
    state,
    new Set(seen).add(binding)
  );
}

/** Resolves one object property's resulting identity, not arbitrary siblings. */
function objectPropertyMayProduceComponent(
  node: t.Node,
  key: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const entry = readObjectEntry(
    node,
    key,
    scope,
    new Set(),
    node.end ?? Number.POSITIVE_INFINITY,
    state
  );
  return entry.status === 'known'
    ? expressionMayProduceComponent(
        entry.expression.node,
        entry.expression.scope,
        state,
        seen,
        kind
      )
    : objectGetterMayProduceComponent(node, key, scope, state, seen, kind) ||
        objectPropertyOriginMayProduceComponent(
          node,
          key,
          scope,
          state,
          seen,
          new Set(),
          kind
        );
}

/** Retains selected-key provenance when mutation makes a container unsafe. */
function objectPropertyOriginMayProduceComponent(
  node: t.Node,
  key: string,
  scope: Scope,
  state: ScriptState,
  seenBindings: Set<Binding>,
  seenNodes: Set<t.Node>,
  kind?: ComponentKind
): boolean {
  return findObjectPropertyOrigins(
    node,
    key,
    scope,
    seenBindings,
    seenNodes,
    state
  ).some((origin) =>
    expressionMayProduceComponent(
      origin.node,
      origin.scope,
      state,
      seenBindings,
      kind
    )
  );
}

/** Finds selected property initializers even when their container later escapes. */
function findObjectPropertyOrigins(
  node: t.Node,
  key: string,
  scope: Scope,
  seenBindings: Set<Binding>,
  seenNodes: Set<t.Node>,
  state: ScriptState
): ScopedExpression[] {
  const expression = unwrapExpression(node);
  if (!expression || seenNodes.has(expression)) return [];
  const nextNodes = new Set(seenNodes).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding || seenBindings.has(binding)) return [];
    const declaration = binding.path.node;
    return declaration.type === 'VariableDeclarator' && declaration.init
      ? findObjectPropertyOrigins(
          declaration.init,
          key,
          binding.path.scope,
          new Set(seenBindings).add(binding),
          nextNodes,
          state
        )
      : [];
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const member = readMemberProperty(expression);
    if (!member) return [];
    return findObjectPropertyOrigins(
      expression.object,
      member,
      scope,
      seenBindings,
      nextNodes,
      state
    ).flatMap((origin) =>
      findObjectPropertyOrigins(
        origin.node,
        key,
        origin.scope,
        seenBindings,
        nextNodes,
        state
      )
    );
  }
  if (expression.type !== 'ObjectExpression') return [];
  return expression.properties.flatMap((property) => {
    if (property.type === 'SpreadElement') {
      return findObjectPropertyOrigins(
        property.argument,
        key,
        scope,
        seenBindings,
        nextNodes,
        state
      );
    }
    return readResolvedPropertyKey(property, scope, state) === key &&
      property.type === 'ObjectProperty'
      ? [{ node: property.value, scope }]
      : [];
  });
}

/** Evaluates a literal getter only when that getter supplies the selected key. */
function objectGetterMayProduceComponent(
  node: t.Node,
  key: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const object = resolveObjectExpression(node, scope, new Set());
  if (!object) return false;
  for (let index = object.node.properties.length - 1; index >= 0; index -= 1) {
    const property = object.node.properties[index];
    if (property.type === 'SpreadElement') continue;
    if (readResolvedPropertyKey(property, object.scope, state) !== key) {
      continue;
    }
    return (
      property.type === 'ObjectMethod' &&
      property.kind === 'get' &&
      functionMayReturnComponent(property, object.scope, state, seen, kind)
    );
  }
  return false;
}

/** Evaluates a literal getter only for possible string-function results. */
function objectGetterMayProduceStringFunction(
  node: t.Node,
  key: string,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  const object = resolveObjectExpression(node, scope, new Set());
  if (!object) return false;
  for (let index = object.node.properties.length - 1; index >= 0; index -= 1) {
    const property = object.node.properties[index];
    if (property.type === 'SpreadElement') continue;
    if (readResolvedPropertyKey(property, object.scope, state) !== key) {
      continue;
    }
    return (
      property.type === 'ObjectMethod' &&
      property.kind === 'get' &&
      functionMayReturnStringFunction(property, object.scope, state, seen)
    );
  }
  return false;
}

/** Evaluates the value source accepted by Vue's computed wrapper. */
function computedSourceMayProduceComponent(
  node: t.Node | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const called = resolveCalledFunction(node, scope, state, new Set());
  if (called) {
    return functionMayReturnComponent(
      called.node,
      called.scope,
      state,
      seen,
      kind
    );
  }
  const object = node
    ? resolveObjectExpression(node, scope, new Set())
    : undefined;
  if (!object) return false;
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') continue;
    if (readResolvedPropertyKey(property, object.scope, state) !== 'get') {
      continue;
    }
    if (property.type === 'ObjectMethod') {
      return functionMayReturnComponent(
        property,
        object.scope,
        state,
        seen,
        kind
      );
    }
    if (property.type === 'ObjectProperty') {
      const getter = resolveCalledFunction(
        property.value,
        object.scope,
        state,
        new Set()
      );
      return Boolean(
        getter &&
        functionMayReturnComponent(getter.node, getter.scope, state, seen, kind)
      );
    }
  }
  return false;
}

/** Evaluates the computed getter for possible string-function results. */
function computedSourceMayProduceStringFunction(
  node: t.Node | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  if (!node) return false;
  const getter = resolveComputedGetter(node, scope, state);
  return Boolean(
    getter &&
    functionMayReturnStringFunction(getter.node, getter.scope, state, seen)
  );
}

/** Resolves a statically invoked local function without invoking user code. */
function resolveCalledFunction(
  node: t.Node | null | undefined,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): (ScopedExpression & { node: t.Function }) | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (
    expression.type === 'FunctionDeclaration' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'ObjectMethod'
  ) {
    return { node: expression, scope };
  }
  if (
    expression.type === 'CallExpression' ||
    expression.type === 'OptionalCallExpression'
  ) {
    const callee = unwrapExpression(expression.callee);
    return callee &&
      (callee.type === 'MemberExpression' ||
        callee.type === 'OptionalMemberExpression') &&
      readResolvedMemberProperty(callee, scope, state) === 'bind'
      ? resolveCalledFunction(callee.object, scope, state, seen)
      : undefined;
  }
  if (
    expression.type === 'MemberExpression' ||
    expression.type === 'OptionalMemberExpression'
  ) {
    const property = readResolvedMemberProperty(expression, scope, state);
    if (!property) return undefined;
    const namespace = resolveKnownExpression(
      expression.object,
      scope,
      state,
      new Set()
    );
    if (namespace?.type === 'local-namespace') {
      const resolution = state.analysis.localModules?.resolveExport(
        namespace.modulePath,
        property
      );
      if (resolution?.status === 'resolved') {
        const callable = materializeLocalExport(
          resolution.target,
          state
        ).callable;
        if (callable) return callable;
      }
    }
    const object = resolveObjectExpression(expression.object, scope, new Set());
    if (object) {
      for (const candidate of object.node.properties) {
        if (
          candidate.type === 'ObjectMethod' &&
          candidate.kind === 'method' &&
          readResolvedPropertyKey(candidate, object.scope, state) === property
        ) {
          return { node: candidate, scope: object.scope };
        }
      }
    }
    for (const origin of findObjectPropertyOrigins(
      expression.object,
      property,
      scope,
      new Set(),
      new Set(),
      state
    )) {
      const called = resolveCalledFunction(
        origin.node,
        origin.scope,
        state,
        seen
      );
      if (called) return called;
    }
    return undefined;
  }
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  const substitution = binding
    ? readParameterSubstitution(binding, state)
    : undefined;
  if (substitution) {
    return resolveCalledFunction(
      substitution.node,
      substitution.scope,
      state,
      seen
    );
  }
  const imported = binding
    ? state.localCallableBindings.get(binding)
    : undefined;
  if (imported) return imported;
  if (binding?.path.isFunctionDeclaration() && binding.constant) {
    return { node: binding.path.node, scope: binding.path.scope };
  }
  if (!binding || !binding.constant) return undefined;
  const declaration = binding?.path.node;
  if (declaration?.type !== 'VariableDeclarator' || !declaration.init) {
    return undefined;
  }
  if (declaration.id.type === 'Identifier') {
    return resolveCalledFunction(
      declaration.init,
      binding.path.scope,
      state,
      seen
    );
  }
  const selected = selectPatternExpression(
    declaration.id,
    declaration.init,
    expression.name,
    binding.path.scope,
    declaration.init.end ?? Number.POSITIVE_INFINITY,
    state
  );
  return selected
    ? resolveCalledFunction(selected.node, selected.scope, state, seen)
    : undefined;
}

/** Detects a call whose implementation is outside this source file. */
function callTargetsUnknownImport(node: t.Node, scope: Scope): boolean {
  const expression = unwrapExpression(node);
  if (!expression || expression.type !== 'Identifier') return false;
  const binding = scope.getBinding(expression.name);
  const parent = binding?.path.parentPath;
  return Boolean(
    binding?.path.isImportSpecifier() ||
      binding?.path.isImportDefaultSpecifier() ||
      binding?.path.isImportNamespaceSpecifier()
      ? parent?.isImportDeclaration() &&
          parent.node.source.value !== 'gt-vue' &&
          parent.node.source.value !== 'vue'
      : false
  );
}

/** Checks only values returned by an invoked function, excluding nested bodies. */
function functionMayReturnComponent(
  fn: t.Function,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  if (state.activeComponentFunctions.has(fn)) return false;
  state.activeComponentFunctions.add(fn);
  try {
    return functionBodyMayReturnComponent(fn, scope, state, seen, kind);
  } finally {
    state.activeComponentFunctions.delete(fn);
  }
}

/** Checks only values returned by a function for string-function identity. */
function functionMayReturnStringFunction(
  fn: t.Function,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  if (state.activeStringFunctions.has(fn)) return false;
  state.activeStringFunctions.add(fn);
  try {
    const functionScope = state.scopes.get(fn) ?? scope;
    if (
      fn.type === 'ArrowFunctionExpression' &&
      fn.body.type !== 'BlockStatement'
    ) {
      return expressionMayProduceStringFunction(
        fn.body,
        functionScope,
        state,
        seen
      );
    }
    const functionPath = state.paths.get(fn);
    if (!functionPath || fn.body.type !== 'BlockStatement') return false;
    let result = false;
    functionPath.traverse({
      Function(path) {
        path.skip();
      },
      ReturnStatement(path) {
        if (
          expressionMayProduceStringFunction(
            path.node.argument,
            path.scope,
            state,
            seen
          )
        ) {
          result = true;
          path.stop();
        }
      },
    });
    return result;
  } finally {
    state.activeStringFunctions.delete(fn);
  }
}

function functionBodyMayReturnComponent(
  fn: t.Function,
  scope: Scope,
  state: ScriptState,
  seen: Set<Binding>,
  kind?: ComponentKind
): boolean {
  const functionScope = state.scopes.get(fn) ?? scope;
  if (
    fn.type === 'ArrowFunctionExpression' &&
    fn.body.type !== 'BlockStatement'
  ) {
    return expressionMayProduceComponent(
      fn.body,
      functionScope,
      state,
      seen,
      kind
    );
  }
  const functionPath = state.paths.get(fn);
  if (!functionPath || fn.body.type !== 'BlockStatement') return false;
  let result = false;
  functionPath.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(path) {
      if (
        expressionMayProduceComponent(
          path.node.argument,
          path.scope,
          state,
          seen,
          kind
        )
      ) {
        result = true;
        path.stop();
      }
    },
  });
  return result;
}

/** Returns whether unresolved Options API data can hide template GT bindings. */
function hasTemplateRelevantBindings(state: ScriptState): boolean {
  return [...state.bindings.values(), ...state.analysis.values.values()].some(
    (value) =>
      value.type === 'component' ||
      value.type === 'hook' ||
      value.type === 'vue-builtin' ||
      value.type === 'namespace' ||
      value.type === 'local-namespace' ||
      value.type === 'string'
  );
}

function resolveOptionsObject(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>
): ScopedExpression | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression')
    return { node: expression, scope };
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (
      !binding ||
      !isSafelyReadContainerBinding(
        binding,
        expression,
        Number.POSITIVE_INFINITY,
        false,
        state
      )
    ) {
      return undefined;
    }
    const source = getBindingSource(binding);
    return source
      ? resolveOptionsObject(
          source.expression.node,
          source.expression.scope,
          state,
          seen
        )
      : undefined;
  }
  if (
    expression.type !== 'CallExpression' &&
    expression.type !== 'OptionalCallExpression'
  ) {
    return undefined;
  }
  const callee = resolveKnownExpression(
    expression.callee,
    scope,
    state,
    new Set()
  );
  if (callee?.type !== 'defineComponent') return undefined;
  const argument = expression.arguments[0];
  return argument &&
    argument.type !== 'SpreadElement' &&
    argument.type !== 'ArgumentPlaceholder'
    ? resolveOptionsObject(argument, scope, state, seen)
    : undefined;
}

function resolveSetupFunction(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>
): t.Function | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (
    expression.type === 'FunctionExpression' ||
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'ObjectMethod'
  ) {
    return expression;
  }
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  if (binding?.path.isFunctionDeclaration()) return binding.path.node;
  const source = binding ? getBindingSource(binding) : undefined;
  return source
    ? resolveSetupFunction(
        source.expression.node,
        source.expression.scope,
        seen
      )
    : undefined;
}

function collectObjectEntries(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>,
  atPosition = node.start ?? Number.POSITIVE_INFINITY,
  state?: ScriptState
): CollectedObjectEntries {
  const result: CollectedObjectEntries = {
    entries: new Map(),
    unknownAll: false,
    unknownNames: new Set(),
  };
  const object = resolveObjectExpression(node, scope, seen, atPosition);
  if (!object) {
    result.unknownAll = true;
    return result;
  }
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      const spreadObject = resolveObjectExpression(
        property.argument,
        object.scope,
        new Set(seen),
        property.argument.start ?? atPosition
      );
      if (!spreadObject) {
        result.entries.clear();
        result.unknownNames.clear();
        result.unknownAll = true;
        continue;
      }
      const spreadEntries = collectObjectEntries(
        spreadObject.node,
        spreadObject.scope,
        new Set(seen),
        property.argument.start ?? atPosition,
        state
      );
      if (spreadEntries.unknownAll) {
        result.entries.clear();
        result.unknownNames.clear();
        result.unknownAll = true;
      }
      for (const name of spreadEntries.unknownNames) {
        result.entries.delete(name);
        result.unknownNames.add(name);
      }
      for (const [name, entry] of spreadEntries.entries) {
        result.entries.set(name, entry);
        result.unknownNames.delete(name);
      }
      continue;
    }
    const key = state
      ? readResolvedPropertyKey(property, object.scope, state)
      : readPropertyKey(property);
    if (key === undefined) {
      result.entries.clear();
      result.unknownNames.clear();
      result.unknownAll = true;
      continue;
    }
    if (property.type === 'ObjectProperty') {
      result.entries.set(key, { node: property.value, scope: object.scope });
      result.unknownNames.delete(key);
    } else if (property.type === 'ObjectMethod' && property.kind === 'method') {
      result.entries.set(key, { node: property, scope: object.scope });
      result.unknownNames.delete(key);
    } else {
      result.entries.delete(key);
      result.unknownNames.add(key);
    }
  }
  return result;
}

function resolveObjectExpression(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>,
  atPosition = node.start ?? Number.POSITIVE_INFINITY
): { node: t.ObjectExpression; scope: Scope } | undefined {
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (expression.type === 'ObjectExpression')
    return { node: expression, scope };
  if (expression.type !== 'Identifier') return undefined;
  const binding = scope.getBinding(expression.name);
  if (
    !binding ||
    !isSafelyReadContainerBinding(binding, expression, atPosition)
  ) {
    return undefined;
  }
  const source = getBindingSource(binding);
  return source
    ? resolveObjectExpression(
        source.expression.node,
        source.expression.scope,
        seen,
        atPosition
      )
    : undefined;
}

/** Reads one flattened array entry while honoring spread copy timing. */
function readArrayEntry(
  node: t.Node,
  index: number,
  scope: Scope,
  seen: Set<t.Node>,
  atPosition = node.end ?? Number.POSITIVE_INFINITY,
  state?: ScriptState
): ObjectEntryResult {
  const entries = state
    ? collectTransformArrayEntries(node, scope, state, seen, atPosition)
    : collectArrayEntries(node, scope, seen, atPosition, state);
  if (!entries) return { status: 'unknown' };
  const entry = entries[index];
  return entry ? { status: 'known', expression: entry } : { status: 'absent' };
}

/** Flattens only statically knowable array literals and array spreads. */
function collectArrayEntries(
  node: t.Node,
  scope: Scope,
  seen: Set<t.Node>,
  atPosition: number,
  state?: ScriptState
): Array<ScopedExpression | undefined> | undefined {
  if (state?.analysis.stats) state.analysis.stats.arrayEntryVisits += 1;
  const expression = unwrapExpression(node);
  if (!expression || seen.has(expression)) return undefined;
  if (
    state &&
    resolveKnownExpression(expression, scope, state, new Set()) !== undefined
  ) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(expression);
  if (expression.type === 'Identifier') {
    const binding = scope.getBinding(expression.name);
    if (!binding) return undefined;
    const cacheable = Boolean(
      state && binding.constant && state.parameterSubstitutions.length === 0
    );
    if (cacheable && state?.arrayEntries.has(binding)) {
      const cached = state.arrayEntries.get(binding);
      return cached ? [...cached] : undefined;
    }
    if (cacheable && state?.arrayEntriesInProgress.has(binding)) {
      return undefined;
    }
    if (cacheable) state?.arrayEntriesInProgress.add(binding);
    try {
      if (
        !isSafelyReadContainerBinding(
          binding,
          expression,
          atPosition,
          false,
          state
        )
      ) {
        if (cacheable) state?.arrayEntries.set(binding, null);
        return undefined;
      }
      const source = getBindingSource(binding);
      const entries =
        source?.pattern.type === 'Identifier'
          ? collectArrayEntries(
              source.expression.node,
              source.expression.scope,
              nextSeen,
              atPosition,
              state
            )
          : undefined;
      if (cacheable) {
        state?.arrayEntries.set(binding, entries ? [...entries] : null);
      }
      return entries;
    } finally {
      if (cacheable) state?.arrayEntriesInProgress.delete(binding);
    }
  }
  if (expression.type !== 'ArrayExpression') return undefined;
  const entries: Array<ScopedExpression | undefined> = [];
  for (const element of expression.elements) {
    if (!element) {
      entries.push(undefined);
      continue;
    }
    if (element.type !== 'SpreadElement') {
      entries.push({ node: element, scope });
      continue;
    }
    const spread = collectArrayEntries(
      element.argument,
      scope,
      nextSeen,
      element.argument.end ?? atPosition,
      state
    );
    if (!spread) return undefined;
    entries.push(...spread);
  }
  return entries;
}

/** Resolves finite array-producing transforms for callbacks and destructuring. */
function collectTransformArrayEntries(
  node: t.Node,
  scope: Scope,
  state: ScriptState,
  seen: Set<t.Node>,
  atPosition = node.end ?? Number.POSITIVE_INFINITY
): Array<ScopedExpression | undefined> | undefined {
  if (state.analysis.stats) {
    state.analysis.stats.transformArrayEntryVisits += 1;
  }
  const direct = collectArrayEntries(node, scope, seen, atPosition, state);
  if (direct) return direct;
  const expression = unwrapExpression(node);
  if (
    expression &&
    resolveKnownExpression(expression, scope, state, new Set()) !== undefined
  ) {
    return undefined;
  }
  if (expression?.type === 'Identifier' && !seen.has(expression)) {
    const binding = scope.getBinding(expression.name);
    const source = binding ? getBindingSource(binding) : undefined;
    const readonlyUses = binding
      ? bindingHasOnlyReadonlyContainerUses(binding, state, new Set())
      : false;
    if (
      binding &&
      source?.pattern.type === 'Identifier' &&
      (isSafelyReadContainerBinding(
        binding,
        expression,
        atPosition,
        true,
        state
      ) ||
        readonlyUses)
    ) {
      const cacheable =
        readonlyUses && state.parameterSubstitutions.length === 0;
      const cached = cacheable
        ? state.transformArrayEntries.get(binding)
        : undefined;
      if (cached !== undefined) {
        return cached ? [...cached] : undefined;
      }
      if (cacheable && state.transformArrayEntriesInProgress.has(binding)) {
        return undefined;
      }
      if (cacheable) state.transformArrayEntriesInProgress.add(binding);
      try {
        const entries = collectTransformArrayEntries(
          source.expression.node,
          source.expression.scope,
          state,
          new Set(seen).add(expression),
          atPosition
        );
        if (cacheable) {
          state.transformArrayEntries.set(
            binding,
            entries ? [...entries] : null
          );
        }
        return entries;
      } finally {
        if (cacheable) state.transformArrayEntriesInProgress.delete(binding);
      }
    }
  }
  if (
    !expression ||
    seen.has(expression) ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression')
  ) {
    return undefined;
  }
  const callee = unwrapExpression(expression.callee);
  if (
    !callee ||
    (callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression')
  ) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(expression);
  const method = readResolvedMemberProperty(callee, scope, state);
  const receiverPath = readResolvedMemberPath(callee.object, scope, state);
  const argument = (index: number): t.Node | undefined => {
    const value = expression.arguments[index];
    return value && value.type !== 'ArgumentPlaceholder'
      ? value.type === 'SpreadElement'
        ? value.argument
        : value
      : undefined;
  };
  const integerArgument = (
    index: number,
    fallback: number
  ): { ok: true; value: number } | { ok: false } => {
    const node = argument(index);
    if (!node) return { ok: true, value: fallback };
    const value = readStaticFromScope(
      node,
      scope,
      new Set(),
      node.end ?? atPosition,
      state.analysis
    );
    if (!value.ok || typeof value.value === 'bigint') return { ok: false };
    try {
      const numeric = Number(value.value);
      return {
        ok: true,
        value: Number.isNaN(numeric) ? 0 : Math.trunc(numeric),
      };
    } catch {
      return { ok: false };
    }
  };
  if (
    receiverPath === 'Array' &&
    method === 'from' &&
    !scope.getBinding('Array')
  ) {
    const source = argument(0);
    const entries = source
      ? collectTransformArrayEntries(source, scope, state, nextSeen, atPosition)
      : undefined;
    const mapperNode = argument(1);
    const mapper = mapperNode
      ? resolveCalledFunction(mapperNode, scope, state, new Set())
      : undefined;
    if (!entries || !mapperNode) return entries;
    if (!mapper) return undefined;
    const mapped: Array<ScopedExpression | undefined> = [];
    for (const [index, entry] of entries.entries()) {
      if (!entry) {
        mapped.push(undefined);
        continue;
      }
      withFunctionParameterSubstitutions(
        mapper,
        [
          entry,
          {
            node: {
              type: 'NumericLiteral',
              value: index,
            } as t.NumericLiteral,
            scope,
          },
        ],
        state,
        () =>
          withFunctionThisSubstitution(
            mapper,
            argument(2) ? { node: argument(2)!, scope } : undefined,
            state,
            () => {
              for (const returned of collectFunctionReturnExpressions(
                mapper.node,
                mapper.scope,
                state
              )) {
                mapped.push(
                  materializeParameterExpression(
                    returned.node,
                    returned.scope,
                    state
                  )
                );
              }
            }
          )
      );
    }
    return mapped;
  }
  if (
    receiverPath === 'Object' &&
    (method === 'values' || method === 'entries') &&
    !scope.getBinding('Object')
  ) {
    const source = argument(0);
    if (!source) return undefined;
    const object = collectObjectEntries(
      source,
      scope,
      new Set(),
      atPosition,
      state
    );
    if (object.unknownAll || object.unknownNames.size > 0) return undefined;
    return [...object.entries].map(([key, value]) =>
      method === 'values'
        ? value
        : {
            node: {
              type: 'ArrayExpression',
              elements: [
                { type: 'StringLiteral', value: key } as t.StringLiteral,
                value.node,
              ],
            } as t.ArrayExpression,
            scope: value.scope,
          }
    );
  }
  if (!method) return undefined;
  if (method === 'concat') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    if (!entries) return undefined;
    const concatenated = [...entries];
    for (const value of expression.arguments) {
      if (
        value.type === 'ArgumentPlaceholder' ||
        value.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const nested = collectTransformArrayEntries(
        value,
        scope,
        state,
        nextSeen,
        atPosition
      );
      if (nested) concatenated.push(...nested);
      else concatenated.push({ node: value, scope });
    }
    return concatenated;
  }
  if (method === 'reduce' || method === 'reduceRight') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const callbackNode = argument(0);
    const callback = callbackNode
      ? resolveCalledFunction(callbackNode, scope, state, new Set())
      : undefined;
    if (!entries || !callback) return undefined;
    const ordered = entries
      .map((entry, index) => (entry ? { entry, index } : undefined))
      .filter(
        (entry): entry is { entry: ScopedExpression; index: number } =>
          entry !== undefined
      );
    if (method === 'reduceRight') ordered.reverse();
    const initial = argument(1);
    let accumulator: ScopedExpression | undefined = initial
      ? materializeParameterExpression(initial, scope, state)
      : ordered.shift()?.entry;
    if (!accumulator) return undefined;
    for (const current of ordered) {
      const currentAccumulator: ScopedExpression = accumulator;
      const nextAccumulator: ScopedExpression | undefined =
        withFunctionParameterSubstitutions(
          callback,
          [
            currentAccumulator,
            current.entry,
            {
              node: {
                type: 'NumericLiteral',
                value: current.index,
              } as t.NumericLiteral,
              scope,
            },
            { node: callee.object, scope },
          ],
          state,
          () => {
            const returned = collectFunctionReturnExpressions(
              callback.node,
              callback.scope,
              state
            );
            return returned.length === 1
              ? materializeParameterExpression(
                  returned[0]!.node,
                  returned[0]!.scope,
                  state
                )
              : undefined;
          }
        );
      if (!nextAccumulator) return undefined;
      accumulator = nextAccumulator;
    }
    return collectTransformArrayEntries(
      accumulator.node,
      accumulator.scope,
      state,
      nextSeen,
      atPosition
    );
  }
  if (method === 'filter') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const callbackNode = argument(0);
    const callback = callbackNode
      ? resolveCalledFunction(callbackNode, scope, state, new Set())
      : undefined;
    if (!entries || !callback) return undefined;
    const filtered: Array<ScopedExpression | undefined> = [];
    for (const [index, entry] of entries.entries()) {
      if (!entry) continue;
      const keep = withFunctionParameterSubstitutions(
        callback,
        [
          entry,
          {
            node: { type: 'NumericLiteral', value: index } as t.NumericLiteral,
            scope,
          },
          { node: callee.object, scope },
        ],
        state,
        () =>
          withFunctionThisSubstitution(
            callback,
            argument(1) ? { node: argument(1)!, scope } : undefined,
            state,
            () => {
              const returned = collectFunctionReturnExpressions(
                callback.node,
                callback.scope,
                state
              );
              if (returned.length === 0) return false;
              const decisions = returned.map((value) => {
                const materialized = materializeParameterExpression(
                  value.node,
                  value.scope,
                  state
                );
                const result = readStaticFromScope(
                  materialized.node,
                  materialized.scope,
                  new Set(),
                  materialized.node.end ?? atPosition,
                  state.analysis
                );
                return result.ok ? Boolean(result.value) : undefined;
              });
              return decisions.every((decision) => decision === false)
                ? false
                : decisions.every((decision) => decision === true)
                  ? true
                  : undefined;
            }
          )
      );
      if (keep === undefined) return undefined;
      if (keep) filtered.push(entry);
    }
    return filtered;
  }
  if (method === 'slice') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const start = integerArgument(0, 0);
    const end = integerArgument(1, entries?.length ?? 0);
    return entries && start.ok && end.ok
      ? entries.slice(start.value, end.value)
      : undefined;
  }
  if (method === 'splice') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const start = integerArgument(0, 0);
    const deleteCount = integerArgument(
      1,
      expression.arguments.length < 2 ? Number.POSITIVE_INFINITY : 0
    );
    if (!entries || !start.ok || !deleteCount.ok) return undefined;
    const copy = [...entries];
    return copy.splice(start.value, Math.max(0, deleteCount.value));
  }
  if (method === 'toSpliced') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const start = integerArgument(0, 0);
    const deleteCount = integerArgument(
      1,
      expression.arguments.length < 2 ? Number.POSITIVE_INFINITY : 0
    );
    if (
      !entries ||
      !start.ok ||
      !deleteCount.ok ||
      expression.arguments
        .slice(2)
        .some((value) => value.type === 'SpreadElement')
    ) {
      return undefined;
    }
    const copy = [...entries];
    copy.splice(
      start.value,
      Math.max(0, deleteCount.value),
      ...expression.arguments.slice(2).map((node) => ({ node, scope }))
    );
    return copy;
  }
  if (method === 'with') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const index = integerArgument(0, 0);
    const value = expression.arguments[1];
    if (
      !entries ||
      !index.ok ||
      !value ||
      value.type === 'ArgumentPlaceholder' ||
      value.type === 'SpreadElement'
    ) {
      return undefined;
    }
    const normalized =
      index.value < 0 ? entries.length + index.value : index.value;
    if (normalized < 0 || normalized >= entries.length) return [];
    const copy = [...entries];
    copy[normalized] = { node: value, scope };
    return copy;
  }
  if (method === 'fill') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const start = integerArgument(1, 0);
    const end = integerArgument(2, entries?.length ?? 0);
    const value = expression.arguments[0];
    if (!entries || !start.ok || !end.ok || value?.type === 'SpreadElement') {
      return undefined;
    }
    return [...entries].fill(
      value && value.type !== 'ArgumentPlaceholder'
        ? { node: value, scope }
        : undefined,
      start.value,
      end.value
    );
  }
  if (method === 'copyWithin') {
    const entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    const target = integerArgument(0, 0);
    const start = integerArgument(1, 0);
    const end = integerArgument(2, entries?.length ?? 0);
    return entries && target.ok && start.ok && end.ok
      ? [...entries].copyWithin(target.value, start.value, end.value)
      : undefined;
  }
  if (['reverse', 'sort', 'toReversed', 'toSorted'].includes(method)) {
    return collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
  }
  if (method === 'flat') {
    let entries = collectTransformArrayEntries(
      callee.object,
      scope,
      state,
      nextSeen,
      atPosition
    );
    if (!entries) return undefined;
    const depthNode = argument(0);
    const staticDepth = depthNode
      ? readStaticFromScope(
          depthNode,
          scope,
          new Set(),
          depthNode.end ?? atPosition,
          state.analysis
        )
      : { ok: true as const, value: 1 };
    if (!staticDepth.ok || typeof staticDepth.value === 'bigint') {
      return undefined;
    }
    const numericDepth = Number(staticDepth.value);
    const depth = Number.isNaN(numericDepth)
      ? 0
      : numericDepth === Number.POSITIVE_INFINITY
        ? 32
        : Math.max(0, Math.trunc(numericDepth));
    for (let level = 0; level < depth; level += 1) {
      const flattened: Array<ScopedExpression | undefined> = [];
      let changed = false;
      for (const entry of entries) {
        if (!entry) {
          flattened.push(undefined);
          continue;
        }
        const nested = collectTransformArrayEntries(
          entry.node,
          entry.scope,
          state,
          nextSeen,
          atPosition
        );
        if (nested) {
          flattened.push(...nested);
          changed = true;
        } else {
          flattened.push(entry);
        }
      }
      entries = flattened;
      if (!changed) break;
    }
    return entries;
  }
  if (method !== 'map' && method !== 'flatMap') return undefined;
  const entries = collectTransformArrayEntries(
    callee.object,
    scope,
    state,
    nextSeen,
    atPosition
  );
  const callbackNode = argument(0);
  const callback = callbackNode
    ? resolveCalledFunction(callbackNode, scope, state, new Set())
    : undefined;
  if (!entries || !callback) return undefined;
  const mapped: Array<ScopedExpression | undefined> = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry) {
      mapped.push(undefined);
      continue;
    }
    withFunctionParameterSubstitutions(
      callback,
      [
        entry,
        {
          node: { type: 'NumericLiteral', value: index } as t.NumericLiteral,
          scope,
        },
        { node: callee.object, scope },
      ],
      state,
      () =>
        withFunctionThisSubstitution(
          callback,
          argument(1) ? { node: argument(1)!, scope } : undefined,
          state,
          () => {
            for (const returned of collectFunctionReturnExpressions(
              callback.node,
              callback.scope,
              state
            )) {
              const materialized = materializeParameterExpression(
                returned.node,
                returned.scope,
                state
              );
              if (method === 'flatMap') {
                const nested = collectTransformArrayEntries(
                  materialized.node,
                  materialized.scope,
                  state,
                  nextSeen,
                  atPosition
                );
                if (nested) {
                  mapped.push(
                    ...nested.map((entry) =>
                      entry
                        ? materializeParameterExpression(
                            entry.node,
                            entry.scope,
                            state
                          )
                        : undefined
                    )
                  );
                  continue;
                }
              }
              mapped.push(materialized);
            }
          }
        )
    );
  }
  return mapped;
}

function readObjectEntry(
  node: t.Node,
  key: string,
  scope: Scope,
  seen: Set<t.Node>,
  atPosition = node.end ?? Number.POSITIVE_INFINITY,
  state?: ScriptState
): ObjectEntryResult {
  const object = resolveObjectExpression(node, scope, seen, atPosition);
  if (!object) return { status: 'unknown' };
  let result: ObjectEntryResult = { status: 'absent' };
  for (const property of object.node.properties) {
    if (property.type === 'SpreadElement') {
      const spread = readObjectEntry(
        property.argument,
        key,
        object.scope,
        seen,
        property.argument.end ?? atPosition,
        state
      );
      if (spread.status !== 'absent') result = spread;
      continue;
    }
    const propertyKey = state
      ? readResolvedPropertyKey(property, object.scope, state)
      : readPropertyKey(property);
    if (!propertyKey) {
      result = { status: 'unknown' };
    } else if (propertyKey === key) {
      result =
        property.type === 'ObjectProperty' ||
        (property.type === 'ObjectMethod' && property.kind === 'method')
          ? {
              status: 'known',
              expression: {
                node:
                  property.type === 'ObjectProperty'
                    ? property.value
                    : property,
                scope: object.scope,
              },
            }
          : { status: 'unknown' };
    }
  }
  return result;
}

/** Proves that a literal container and all of its const aliases are read-only. */
function bindingHasOnlyReadonlyContainerUses(
  binding: Binding,
  state: ScriptState,
  seen: Set<Binding>
): boolean {
  const cached = state.readonlyContainerUses.get(binding);
  if (cached !== undefined) return cached;
  if (!binding.constant || seen.has(binding)) return seen.has(binding);
  if (state.readonlyContainerUsesInProgress.has(binding)) {
    return seen.has(binding);
  }
  state.readonlyContainerUsesInProgress.add(binding);
  const nextSeen = new Set(seen).add(binding);
  try {
    const result = binding.referencePaths.every((reference) => {
      const parent = reference.parentPath;
      if (!parent) return false;
      if (
        parent.isVariableDeclarator() &&
        parent.node.init === reference.node
      ) {
        if (parent.node.id.type !== 'Identifier') return false;
        const alias = parent.scope.getBinding(parent.node.id.name);
        return Boolean(
          alias && bindingHasOnlyReadonlyContainerUses(alias, state, nextSeen)
        );
      }
      if (
        (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
        parent.node.object === reference.node
      ) {
        let member: NodePath<t.MemberExpression | t.OptionalMemberExpression> =
          parent;
        while (
          member.parentPath &&
          (member.parentPath.isMemberExpression() ||
            member.parentPath.isOptionalMemberExpression()) &&
          member.parentPath.node.object === member.node
        ) {
          member = member.parentPath;
        }
        const call = member.parentPath;
        if (
          call &&
          (call.isCallExpression() || call.isOptionalCallExpression()) &&
          call.node.callee === member.node
        ) {
          const method = readResolvedMemberProperty(
            member.node,
            member.scope,
            state
          );
          return Boolean(method && READONLY_ARRAY_TRANSFORMS.has(method));
        }
        return memberChainIsReadOnly(parent);
      }
      if (
        (parent.isCallExpression() || parent.isOptionalCallExpression()) &&
        parent.node.arguments.some((argument) => argument === reference.node)
      ) {
        const callee = readResolvedMemberPath(
          parent.node.callee,
          parent.scope,
          state
        );
        return (
          callee === 'Array.from' ||
          callee === 'Object.entries' ||
          callee === 'Object.values'
        );
      }
      return false;
    });
    state.readonlyContainerUses.set(binding, result);
    return result;
  } finally {
    state.readonlyContainerUsesInProgress.delete(binding);
  }
}

/**
 * Rejects container aliases that can be mutated or escape static analysis.
 *
 * Babel's `binding.constant` does not account for writes through object
 * members. Following an initializer in that case can publish a catalog for a
 * value that does not exist at runtime. Only local property reads, static
 * destructuring, and object/array copies are safe to inspect.
 */
function isSafelyReadContainerBinding(
  binding: Binding,
  currentReference: t.Identifier,
  atPosition: number,
  allowMemberCalls = false,
  state?: ScriptState
): boolean {
  const currentFunction = binding.referencePaths
    .find((reference) => reference.node === currentReference)
    ?.getFunctionParent()?.node;
  return binding.referencePaths.every((reference) => {
    if (reference.node === currentReference) return true;
    if (
      reference.getFunctionParent()?.node === currentFunction &&
      (reference.node.start ?? Number.POSITIVE_INFINITY) >= atPosition
    ) {
      return true;
    }
    const parent = reference.parentPath;
    if (!parent) return false;

    if (
      (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
      parent.node.object === reference.node
    ) {
      if (literalObjectMemberIsGetter(binding, parent.node)) return false;
      return (
        memberChainCallsKnownStringLeaf(binding, parent, state) ||
        !memberChainCanMutate(parent, allowMemberCalls) ||
        (memberChainIsReadOnly(parent) &&
          literalObjectMemberIsPrimitive(binding, parent.node))
      );
    }
    if (parent.isSpreadElement()) {
      return false;
    }
    if (parent.isVariableDeclarator() && parent.node.init === reference.node) {
      return false;
    }
    if (
      parent.isAssignmentExpression() &&
      parent.node.right === reference.node
    ) {
      return false;
    }
    return false;
  });
}

/**
 * Allows a proven translator leaf to be called without treating its parent
 * object as escaped. Arbitrary object methods remain unsafe because they can
 * mutate sibling properties through a closure or `this`.
 */
function memberChainCallsKnownStringLeaf(
  binding: Binding,
  firstMember: NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  state: ScriptState | undefined
): boolean {
  if (!state) return false;
  const properties: string[] = [];
  let current: NodePath<t.Node> = firstMember;
  while (current.isMemberExpression() || current.isOptionalMemberExpression()) {
    const property = readResolvedMemberProperty(
      current.node,
      current.scope,
      state
    );
    if (property === undefined) return false;
    properties.push(property);
    const parent = current.parentPath;
    if (
      !parent ||
      (!parent.isMemberExpression() && !parent.isOptionalMemberExpression()) ||
      parent.node.object !== current.node
    ) {
      break;
    }
    current = parent;
  }
  const call = current.parentPath;
  if (
    !call ||
    (!call.isCallExpression() && !call.isOptionalCallExpression()) ||
    call.node.callee !== current.node
  ) {
    return false;
  }
  const declaration = binding.path.node;
  if (
    declaration.type !== 'VariableDeclarator' ||
    declaration.id.type !== 'Identifier' ||
    !declaration.init
  ) {
    return false;
  }
  let selected: ScopedExpression = {
    node: declaration.init,
    scope: binding.path.scope,
  };
  for (const property of properties) {
    const entry = readObjectEntry(
      selected.node,
      property,
      selected.scope,
      new Set(),
      call.node.start ?? Number.POSITIVE_INFINITY,
      state
    );
    if (entry.status !== 'known') return false;
    selected = entry.expression;
  }
  return (
    resolveKnownExpression(
      selected.node,
      selected.scope,
      state,
      new Set([binding])
    )?.type === 'string'
  );
}

/** Returns the direct literal property selected from a container declaration. */
function readLiteralContainerProperty(
  binding: Binding,
  member: t.MemberExpression | t.OptionalMemberExpression
): t.ObjectExpression['properties'][number] | undefined {
  const key = readMemberProperty(member);
  const declaration = binding.path.node;
  const initializer =
    declaration.type === 'VariableDeclarator'
      ? unwrapExpression(declaration.init)
      : undefined;
  if (!key || initializer?.type !== 'ObjectExpression') return undefined;
  let result: t.ObjectExpression['properties'][number] | undefined;
  for (const property of initializer.properties) {
    if (property.type === 'SpreadElement' || !readPropertyKey(property)) {
      result = undefined;
      continue;
    }
    if (readPropertyKey(property) === key) result = property;
  }
  return result;
}

/** Getter reads can mutate sibling properties before a later static read. */
function literalObjectMemberIsGetter(
  binding: Binding,
  member: t.MemberExpression | t.OptionalMemberExpression
): boolean {
  const property = readLiteralContainerProperty(binding, member);
  return property?.type === 'ObjectMethod' && property.kind === 'get';
}

/** Escaping a primitive sibling value cannot mutate the source container. */
function literalObjectMemberIsPrimitive(
  binding: Binding,
  member: t.MemberExpression | t.OptionalMemberExpression
): boolean {
  const property = readLiteralContainerProperty(binding, member);
  return (
    property?.type === 'ObjectProperty' &&
    readStaticPrimitive(property.value, () => ({ ok: false })).ok
  );
}

/** Distinguishes a harmless value read from a write or method invocation. */
function memberChainIsReadOnly(
  memberPath: NodePath<t.MemberExpression | t.OptionalMemberExpression>
): boolean {
  let current: NodePath<t.Node> = memberPath;
  while (
    current.parentPath &&
    (current.parentPath.isMemberExpression() ||
      current.parentPath.isOptionalMemberExpression()) &&
    current.parentPath.node.object === current.node
  ) {
    current = current.parentPath;
  }
  const parent = current.parentPath;
  if (!parent) return false;
  if (
    (parent.isAssignmentExpression() && parent.node.left === current.node) ||
    (parent.isUpdateExpression() && parent.node.argument === current.node) ||
    (parent.isUnaryExpression({ operator: 'delete' }) &&
      parent.node.argument === current.node) ||
    ((parent.isForInStatement() || parent.isForOfStatement()) &&
      parent.node.left === current.node) ||
    ((parent.isCallExpression() || parent.isOptionalCallExpression()) &&
      parent.node.callee === current.node) ||
    (parent.isNewExpression() && parent.node.callee === current.node) ||
    (parent.isTaggedTemplateExpression() && parent.node.tag === current.node)
  ) {
    return false;
  }
  return true;
}

/** Returns whether a member read is used to mutate or escape its container. */
function memberChainCanMutate(
  memberPath: NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  allowCalls: boolean
): boolean {
  let current: NodePath<t.Node> = memberPath;
  while (
    current.parentPath &&
    (current.parentPath.isMemberExpression() ||
      current.parentPath.isOptionalMemberExpression()) &&
    current.parentPath.node.object === current.node
  ) {
    current = current.parentPath;
  }
  while (current.parentPath) {
    const parent = current.parentPath;
    if (
      (parent.isAssignmentExpression() && parent.node.left === current.node) ||
      (parent.isUpdateExpression() && parent.node.argument === current.node) ||
      (parent.isUnaryExpression({ operator: 'delete' }) &&
        parent.node.argument === current.node) ||
      ((parent.isForInStatement() || parent.isForOfStatement()) &&
        parent.node.left === current.node)
    ) {
      return true;
    }
    if (
      (parent.isCallExpression() || parent.isOptionalCallExpression()) &&
      (parent.node.callee !== current.node || !allowCalls)
    ) {
      return true;
    }
    if (
      parent.isNewExpression() &&
      (parent.node.callee !== current.node || !allowCalls)
    ) {
      return true;
    }
    if (
      parent.isTaggedTemplateExpression() &&
      (parent.node.tag !== current.node || !allowCalls)
    ) {
      return true;
    }
    if (
      (parent.isVariableDeclarator() && parent.node.init === current.node) ||
      (parent.isAssignmentExpression() && parent.node.right === current.node) ||
      (parent.isReturnStatement() && parent.node.argument === current.node) ||
      parent.isSpreadElement() ||
      (parent.isObjectProperty() && parent.node.value === current.node) ||
      (parent.isArrayExpression() &&
        parent.node.elements.some((element) => element === current.node))
    ) {
      return true;
    }
    if (!isAssignmentTargetWrapper(parent, current)) return false;
    current = parent;
  }
  return true;
}

function readStaticFromScope(
  node: t.Node | null | undefined,
  scope: Scope,
  seen: Set<Binding>,
  atPosition: number,
  analysis?: VueScriptAnalysis
): StaticPrimitiveResult {
  return readStaticPrimitive(node, (identifier) => {
    const binding = scope.getBinding(identifier.name);
    if (!binding) {
      if (analysis?.staticValues.has(identifier.name)) {
        return {
          ok: true,
          value: analysis.staticValues.get(identifier.name) as StaticPrimitive,
        };
      }
      return readStaticGlobalPrimitive(identifier.name);
    }
    const cacheable =
      analysis !== undefined && atPosition === Number.POSITIVE_INFINITY;
    const cached = cacheable
      ? staticBindingResults.get(analysis)?.get(binding)
      : undefined;
    if (cached) return cached;
    if (seen.has(binding)) return { ok: false };
    if (cacheable) {
      const active = staticBindingsInProgress.get(analysis) ?? new Set();
      if (active.has(binding)) return { ok: false };
      active.add(binding);
      staticBindingsInProgress.set(analysis, active);
    }
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    try {
      const source = getBindingSource(binding);
      const expression =
        source && (source.expression.node.end ?? 0) <= atPosition
          ? selectPatternExpression(
              source.pattern,
              source.expression.node,
              binding.identifier.name,
              source.expression.scope,
              source.expression.node.end ?? Number.POSITIVE_INFINITY
            )
          : undefined;
      const result: StaticPrimitiveResult = expression
        ? readStaticFromScope(
            expression.node,
            expression.scope,
            nextSeen,
            atPosition,
            analysis
          )
        : { ok: false };
      if (cacheable) {
        const results = staticBindingResults.get(analysis) ?? new Map();
        results.set(binding, result);
        staticBindingResults.set(analysis, results);
      }
      return result;
    } finally {
      if (cacheable) {
        const active = staticBindingsInProgress.get(analysis);
        active?.delete(binding);
      }
    }
  });
}

function selectPatternExpression(
  pattern: t.Node,
  value: t.Node,
  targetName: string,
  scope: Scope,
  atPosition = value.end ?? Number.POSITIVE_INFINITY,
  state?: ScriptState
): ScopedExpression | undefined {
  if (pattern.type === 'Identifier') {
    return pattern.name === targetName ? { node: value, scope } : undefined;
  }
  if (pattern.type === 'AssignmentPattern') {
    if (isStaticallyUndefined(value, scope)) {
      return selectPatternExpression(
        pattern.left,
        pattern.right,
        targetName,
        scope,
        atPosition,
        state
      );
    }
    return selectPatternExpression(
      pattern.left,
      value,
      targetName,
      scope,
      atPosition,
      state
    );
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type !== 'ObjectProperty') continue;
      if (!patternContains(property.value, targetName)) continue;
      const key = state
        ? readResolvedPropertyKey(property, scope, state)
        : readPropertyKey(property);
      if (key === undefined) return undefined;
      const entry = readObjectEntry(
        value,
        key,
        scope,
        new Set(),
        atPosition,
        state
      );
      return entry.status === 'known'
        ? selectPatternExpression(
            property.value,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            atPosition,
            state
          )
        : entry.status === 'absent'
          ? selectPatternDefault(property.value, targetName, scope)
          : undefined;
    }
  }
  if (pattern.type === 'ArrayPattern') {
    for (let index = 0; index < pattern.elements.length; index += 1) {
      const target = pattern.elements[index];
      if (!target || !patternContains(target, targetName)) continue;
      const entry = readArrayEntry(
        value,
        index,
        scope,
        new Set(),
        atPosition,
        state
      );
      if (entry.status === 'absent') {
        return selectPatternDefault(target, targetName, scope);
      }
      return entry.status === 'known'
        ? selectPatternExpression(
            target,
            entry.expression.node,
            targetName,
            entry.expression.scope,
            atPosition,
            state
          )
        : undefined;
    }
  }
  return undefined;
}

function selectPatternDefault(
  pattern: t.Node,
  targetName: string,
  scope: Scope
): ScopedExpression | undefined {
  return pattern.type === 'AssignmentPattern' &&
    patternContains(pattern.left, targetName)
    ? { node: pattern.right, scope }
    : undefined;
}

function readRequireNamespace(
  node: t.Node | null | undefined,
  scope: Scope
): Extract<KnownValue, { type: 'namespace' }> | undefined {
  const expression = unwrapExpression(node);
  if (
    !expression ||
    (expression.type !== 'CallExpression' &&
      expression.type !== 'OptionalCallExpression') ||
    expression.callee.type !== 'Identifier' ||
    expression.callee.name !== 'require' ||
    scope.getBinding('require') ||
    expression.arguments.length !== 1
  ) {
    return undefined;
  }
  const argument = expression.arguments[0];
  if (argument?.type !== 'StringLiteral') return undefined;
  return argument.value === 'gt-vue' || argument.value === 'vue'
    ? { type: 'namespace', source: argument.value, mutable: true }
    : undefined;
}

/** Resolves a member key when its computed expression is statically primitive. */
function readResolvedMemberProperty(
  node: t.MemberExpression | t.OptionalMemberExpression,
  scope: Scope,
  state: ScriptState
): string | undefined {
  const direct = readMemberProperty(node);
  if (direct !== undefined || !node.computed) return direct;
  const computed = unwrapExpression(node.property);
  const binding =
    computed?.type === 'Identifier'
      ? scope.getBinding(computed.name)
      : undefined;
  const substitution = binding
    ? readParameterSubstitution(binding, state)
    : undefined;
  const materialized =
    !substitution && computed
      ? materializeParameterExpression(computed, scope, state)
      : undefined;
  const property = readStaticFromScope(
    substitution?.node ?? materialized?.node ?? node.property,
    substitution?.scope ?? materialized?.scope ?? scope,
    new Set(),
    node.property.end ?? Number.POSITIVE_INFINITY,
    state.analysis
  );
  return property.ok &&
    (typeof property.value === 'string' || typeof property.value === 'number')
    ? String(property.value)
    : undefined;
}

/** Resolves an object key whose computed expression is statically primitive. */
function readResolvedPropertyKey(
  property: { computed: boolean; key: t.Node },
  scope: Scope,
  state: ScriptState
): string | undefined {
  const direct = readPropertyKey(property);
  if (direct !== undefined || !property.computed) return direct;
  const key = readStaticFromScope(
    property.key,
    scope,
    new Set(),
    property.key.end ?? Number.POSITIVE_INFINITY,
    state.analysis
  );
  return key.ok &&
    (typeof key.value === 'string' || typeof key.value === 'number')
    ? String(key.value)
    : undefined;
}
