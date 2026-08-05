import type { Binding, NodePath, Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import {
  readStaticPrimitive,
  unwrapExpression,
  type StaticPrimitiveResult,
} from '../utils.js';
import type {
  CollectedObjectEntries,
  ContainerWritePolicy,
  FinalContainerOperation,
  FinalContainerSnapshot,
  KnownValue,
  ScopedExpression,
  ScriptState,
  VueScriptAnalysis,
} from './model.js';

/** Static-analysis operations consumed by finite snapshot evaluation. */
export type SnapshotAnalysisDependencies = {
  readonlyArrayTransforms: ReadonlySet<string>;
  collectObjectEntries: (
    node: t.Node,
    scope: Scope,
    seen: Set<t.Node>,
    atPosition?: number,
    state?: ScriptState
  ) => CollectedObjectEntries;
  collectTransformArrayEntries: (
    node: t.Node,
    scope: Scope,
    state: ScriptState,
    seen: Set<t.Node>,
    atPosition?: number
  ) => Array<ScopedExpression | undefined> | undefined;
  memberChainIsReadOnly: (
    memberPath: NodePath<t.MemberExpression | t.OptionalMemberExpression>
  ) => boolean;
  readBindingContainerWritePolicy: (
    binding: Binding,
    state: ScriptState,
    seen?: Set<Binding>
  ) => ContainerWritePolicy | undefined;
  readResolvedMemberPath: (
    node: t.Node,
    scope: Scope,
    state: ScriptState
  ) => string | undefined;
  readResolvedMemberProperty: (
    node: t.MemberExpression | t.OptionalMemberExpression,
    scope: Scope,
    state: ScriptState
  ) => string | undefined;
  readStaticFromScope: (
    node: t.Node | null | undefined,
    scope: Scope,
    seen: Set<Binding>,
    atPosition: number,
    analysis?: VueScriptAnalysis,
    allowNumericGlobals?: boolean
  ) => StaticPrimitiveResult;
  resolveKnownExpression: (
    node: t.Node | null | undefined,
    scope: Scope,
    state: ScriptState,
    seen: Set<Binding>
  ) => KnownValue | undefined;
  resolveVueTemplateContainerSources: (
    node: t.Node,
    scope: Scope,
    state: ScriptState
  ) => ScopedExpression[] | undefined;
};

/** Narrow snapshot queries used by replay and conservative provenance. */
export type SnapshotAnalysis = {
  readDefiniteArrayInteger: (
    node: t.Node | undefined,
    fallback: number,
    scope: Scope,
    state: ScriptState
  ) => number | undefined;
  readDefiniteFinalContainerHasGT: (
    binding: Binding,
    state: ScriptState
  ) => boolean | undefined;
  readDefiniteFinalContainerSnapshot: (
    binding: Binding,
    state: ScriptState
  ) => FinalContainerSnapshot | undefined;
};

/** Creates the conservative finite-container snapshot analyzer. */
export function createSnapshotAnalysis({
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
}: SnapshotAnalysisDependencies): SnapshotAnalysis {
  /** Copies a replay snapshot before another binding applies its own writes. */
  function cloneFinalContainerSnapshot(
    snapshot: FinalContainerSnapshot
  ): FinalContainerSnapshot {
    return snapshot.kind === 'array'
      ? { kind: 'array', entries: [...snapshot.entries] }
      : { kind: 'object', entries: new Map(snapshot.entries) };
  }

  /** Reads an exact finite container without assuming arbitrary calls are pure. */
  function readFinalContainerSnapshot(
    node: t.Node,
    scope: Scope,
    state: ScriptState
  ): FinalContainerSnapshot | undefined {
    if (state.analysis.stats) {
      state.analysis.stats.finalContainerSnapshotReads += 1;
    }
    // A resolved GT/Vue identity or string function is an exact scalar, not a
    // finite container. This shortcut is especially important for immutable
    // alias chains whose final value is later stored in a mutable registry.
    if (resolveKnownExpression(node, scope, state, new Set())) return undefined;
    const array = collectTransformArrayEntries(
      node,
      scope,
      state,
      new Set(),
      Number.POSITIVE_INFINITY
    );
    if (array) return { kind: 'array', entries: [...array] };
    const object = collectObjectEntries(
      node,
      scope,
      new Set(),
      Number.POSITIVE_INFINITY,
      state
    );
    if (!object.unknownAll && object.unknownNames.size === 0) {
      return { kind: 'object', entries: new Map(object.entries) };
    }
    const sources = resolveVueTemplateContainerSources(node, scope, state);
    if (sources?.length !== 1) return undefined;
    const sourceExpression = unwrapExpression(sources[0].node);
    if (sourceExpression?.type === 'Identifier') {
      const sourceBinding = sources[0].scope.getBinding(sourceExpression.name);
      if (sourceBinding) {
        const finalSource = readDefiniteFinalContainerSnapshot(
          sourceBinding,
          state
        );
        if (finalSource) return finalSource;
      }
    }
    return readFinalContainerSnapshot(sources[0].node, sources[0].scope, state);
  }

  /** Determines whether a finite expression definitely contains T anywhere. */
  function readDefiniteExpressionHasGT(
    node: t.Node,
    scope: Scope,
    state: ScriptState,
    seen: Set<t.Node>
  ): boolean | undefined {
    const expression = unwrapExpression(node);
    if (!expression || seen.has(expression)) return undefined;
    const nextSeen = new Set(seen).add(expression);
    const known = resolveKnownExpression(expression, scope, state, new Set());
    if (known) {
      return known.type === 'component' ? known.name === 'T' : false;
    }
    const primitive = readStaticFromScope(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    if (primitive.ok) return false;
    if (
      expression.type === 'Identifier' &&
      !scope.getBinding(expression.name) &&
      [
        'Array',
        'BigInt',
        'Boolean',
        'Date',
        'Error',
        'Map',
        'Number',
        'Object',
        'RegExp',
        'Set',
        'String',
        'Symbol',
        'WeakMap',
        'WeakSet',
        'undefined',
      ].includes(expression.name)
    ) {
      return false;
    }
    const snapshot = readFinalContainerSnapshot(expression, scope, state);
    if (!snapshot) return undefined;
    const values =
      snapshot.kind === 'array'
        ? snapshot.entries.filter(
            (entry): entry is ScopedExpression => entry !== undefined
          )
        : [...snapshot.entries.values()];
    let unknown = false;
    for (const value of values) {
      const hasGT = readDefiniteExpressionHasGT(
        value.node,
        value.scope,
        state,
        nextSeen
      );
      if (hasGT) return true;
      if (hasGT === undefined) unknown = true;
    }
    return unknown ? undefined : false;
  }

  /** Coerces a statically known array index with JavaScript integer semantics. */
  function readDefiniteArrayInteger(
    node: t.Node | undefined,
    fallback: number,
    scope: Scope,
    state: ScriptState
  ): number | undefined {
    if (!node) return fallback;
    const expression = unwrapExpression(node);
    if (
      expression?.type === 'Identifier' &&
      expression.name === 'undefined' &&
      !scope.getBinding('undefined')
    ) {
      return 0;
    }
    const value = readStaticFromScope(
      node,
      scope,
      new Set(),
      node.end ?? Number.POSITIVE_INFINITY,
      state.analysis,
      true
    );
    if (!value.ok || typeof value.value === 'bigint') return undefined;
    try {
      const numeric = Number(value.value);
      return Number.isNaN(numeric) ? 0 : Math.trunc(numeric);
    } catch {
      return undefined;
    }
  }

  /** Accepts only synchronous top-level operations that definitely run in order. */
  function isUnconditionalSiblingOperation(
    binding: Binding,
    operation: NodePath<t.Node>
  ): boolean {
    const declarationStatement = binding.path.getStatementParent();
    const operationStatement = operation.getStatementParent();
    return Boolean(
      declarationStatement &&
      (operationStatement?.isExpressionStatement() ||
        operationStatement?.isVariableDeclaration()) &&
      declarationStatement.parentPath?.node ===
        operationStatement.parentPath?.node &&
      binding.referencePaths.every(
        (reference) =>
          reference.getFunctionParent()?.node ===
          operation.getFunctionParent()?.node
      )
    );
  }

  /** Applies one direct member replacement to a finite container snapshot. */
  function replaceFinalContainerMember(
    snapshot: FinalContainerSnapshot,
    property: string,
    value: ScopedExpression
  ): FinalContainerSnapshot | undefined {
    if (snapshot.kind === 'object') {
      snapshot.entries.set(property, value);
      return snapshot;
    }
    if (property === 'length') {
      const length = readStaticPrimitive(value.node, () => ({ ok: false }));
      if (
        !length.ok ||
        typeof length.value !== 'number' ||
        !Number.isInteger(length.value) ||
        length.value < 0
      ) {
        return undefined;
      }
      snapshot.entries.length = length.value;
      return snapshot;
    }
    if (!/^(0|[1-9]\d*)$/.test(property)) return undefined;
    snapshot.entries[Number(property)] = value;
    return snapshot;
  }

  /**
   * Evaluates the final value of a directly mutated finite container.
   * Unknown control flow, dynamic keys, callbacks, and escapes return unknown so
   * the normal fail-closed provenance remains in place.
   */
  function readDefiniteFinalContainerSnapshot(
    binding: Binding,
    state: ScriptState
  ): FinalContainerSnapshot | undefined {
    const cached = state.finalContainerSnapshots.get(binding);
    if (cached) return cloneFinalContainerSnapshot(cached);
    if (state.finalContainerSnapshotsInProgress.has(binding)) return undefined;
    state.finalContainerSnapshotsInProgress.add(binding);
    try {
      const replay = computeDefiniteFinalContainerSnapshot(binding, state);
      if (!replay) return undefined;
      for (const relatedBinding of replay.relatedBindings) {
        state.finalContainerSnapshots.set(
          relatedBinding,
          cloneFinalContainerSnapshot(replay.snapshot)
        );
      }
      return cloneFinalContainerSnapshot(replay.snapshot);
    } finally {
      state.finalContainerSnapshotsInProgress.delete(binding);
    }
  }

  /** Replays exact writes and returns aliases that retain the same identity. */
  function computeDefiniteFinalContainerSnapshot(
    binding: Binding,
    state: ScriptState
  ):
    | {
        snapshot: FinalContainerSnapshot;
        relatedBindings: Set<Binding>;
      }
    | undefined {
    const declaration = binding.path.node;
    if (
      declaration.type !== 'VariableDeclarator' ||
      declaration.id.type !== 'Identifier' ||
      !declaration.init
    ) {
      return undefined;
    }
    let snapshot = readFinalContainerSnapshot(
      declaration.init,
      binding.path.scope,
      state
    );
    if (!snapshot) return undefined;
    const operations: FinalContainerOperation[] = [];
    const addRootAssignment = (
      assignment: NodePath<t.AssignmentExpression>
    ): boolean => {
      if (
        assignment.node.operator !== '=' ||
        assignment.node.left.type !== 'Identifier' ||
        assignment.node.left.name !== binding.identifier.name ||
        !isUnconditionalSiblingOperation(binding, assignment)
      ) {
        return false;
      }
      operations.push({
        position: assignment.node.start ?? Number.POSITIVE_INFINITY,
        apply: () =>
          readFinalContainerSnapshot(
            assignment.node.right,
            assignment.scope,
            state
          ),
      });
      return true;
    };
    for (const violation of binding.constantViolations) {
      if (
        !violation.isAssignmentExpression() ||
        !addRootAssignment(violation)
      ) {
        return undefined;
      }
    }

    const pendingBindings = [binding];
    const seenBindings = new Set<Binding>();
    for (
      let bindingIndex = 0;
      bindingIndex < pendingBindings.length;
      bindingIndex += 1
    ) {
      const currentBinding = pendingBindings[bindingIndex];
      if (!currentBinding || seenBindings.has(currentBinding)) continue;
      seenBindings.add(currentBinding);
      if (
        currentBinding !== binding &&
        currentBinding.constantViolations.length > 0
      ) {
        return undefined;
      }
      const writePolicy = readBindingContainerWritePolicy(
        currentBinding,
        state
      );
      const blocksWriteAtDepth = (depth: number): boolean =>
        writePolicy === 'readonly-deep' ||
        (writePolicy === 'readonly-shallow' && depth <= 1);
      for (const reference of currentBinding.referencePaths) {
        const parent = reference.parentPath;
        if (!parent) return undefined;
        if (
          parent.isAssignmentExpression() &&
          parent.node.left === reference.node
        ) {
          continue;
        }
        if (
          parent.isVariableDeclarator() &&
          parent.node.init === reference.node &&
          parent.node.id.type === 'Identifier'
        ) {
          if (binding.constantViolations.length > 0) return undefined;
          if (!isUnconditionalSiblingOperation(binding, parent))
            return undefined;
          const alias = parent.scope.getBinding(parent.node.id.name);
          if (!alias) return undefined;
          pendingBindings.push(alias);
          continue;
        }
        if (
          parent.isCallExpression() &&
          parent.node.arguments.includes(
            reference.node as t.Expression | t.SpreadElement
          )
        ) {
          const wrapper = resolveKnownExpression(
            parent.node.callee,
            parent.scope,
            state,
            new Set()
          );
          if (
            wrapper?.type === 'container-wrapper' &&
            wrapper.writePolicy !== 'forward'
          ) {
            continue;
          }
          const callee = readResolvedMemberPath(
            parent.node.callee,
            parent.scope,
            state
          );
          const argumentIndex = parent.node.arguments.indexOf(
            reference.node as t.Expression | t.SpreadElement
          );
          if (
            callee !== 'Object.assign' ||
            parent.scope.getBinding('Object') ||
            argumentIndex !== 0 ||
            !isUnconditionalSiblingOperation(binding, parent)
          ) {
            return undefined;
          }
          if (blocksWriteAtDepth(1)) continue;
          const sources = parent.node.arguments.slice(1);
          operations.push({
            position: parent.node.start ?? Number.POSITIVE_INFINITY,
            apply: (current) => {
              if (current.kind !== 'object') return undefined;
              for (const source of sources) {
                if (
                  source.type === 'ArgumentPlaceholder' ||
                  source.type === 'SpreadElement'
                ) {
                  return undefined;
                }
                const entries = collectObjectEntries(
                  source,
                  parent.scope,
                  new Set(),
                  source.end ?? Number.POSITIVE_INFINITY,
                  state
                );
                if (entries.unknownAll || entries.unknownNames.size > 0) {
                  return undefined;
                }
                for (const [key, value] of entries.entries) {
                  current.entries.set(key, value);
                }
              }
              return current;
            },
          });
          continue;
        }
        if (
          !parent.isMemberExpression() &&
          !parent.isOptionalMemberExpression()
        ) {
          return undefined;
        }
        const firstMember = parent;
        let current: NodePath<t.Node> = firstMember;
        let depth = 1;
        while (
          current.parentPath &&
          (current.parentPath.isMemberExpression() ||
            current.parentPath.isOptionalMemberExpression()) &&
          current.parentPath.node.object === current.node
        ) {
          current = current.parentPath;
          depth += 1;
        }
        const terminal = current.parentPath;
        const property = readResolvedMemberProperty(
          firstMember.node,
          firstMember.scope,
          state
        );
        if (
          depth === 1 &&
          property !== undefined &&
          terminal?.isAssignmentExpression() &&
          terminal.node.left === current.node &&
          terminal.node.operator === '=' &&
          isUnconditionalSiblingOperation(binding, terminal)
        ) {
          if (blocksWriteAtDepth(1)) continue;
          operations.push({
            position: terminal.node.start ?? Number.POSITIVE_INFINITY,
            apply: (value) =>
              replaceFinalContainerMember(value, property, {
                node: terminal.node.right,
                scope: terminal.scope,
              }),
          });
          continue;
        }
        if (
          depth === 1 &&
          property !== undefined &&
          terminal?.isCallExpression() &&
          terminal.node.callee === current.node &&
          isUnconditionalSiblingOperation(binding, terminal)
        ) {
          if (blocksWriteAtDepth(1)) continue;
          const method = property;
          const args = terminal.node.arguments;
          if (
            args.some(
              (argument) =>
                argument.type === 'ArgumentPlaceholder' ||
                argument.type === 'SpreadElement'
            )
          ) {
            return undefined;
          }
          operations.push({
            position: terminal.node.start ?? Number.POSITIVE_INFINITY,
            apply: (value) => {
              if (value.kind !== 'array') return undefined;
              const entries = value.entries;
              const scoped = (index: number): ScopedExpression | undefined => {
                const argument = args[index];
                return argument && argument.type !== 'ArgumentPlaceholder'
                  ? { node: argument, scope: terminal.scope }
                  : undefined;
              };
              if (method === 'pop') entries.pop();
              else if (method === 'shift') entries.shift();
              else if (method === 'push') {
                entries.push(
                  ...args.map((argument) => ({
                    node: argument as t.Expression,
                    scope: terminal.scope,
                  }))
                );
              } else if (method === 'unshift') {
                entries.unshift(
                  ...args.map((argument) => ({
                    node: argument as t.Expression,
                    scope: terminal.scope,
                  }))
                );
              } else if (method === 'splice') {
                const start = readDefiniteArrayInteger(
                  scoped(0)?.node,
                  0,
                  terminal.scope,
                  state
                );
                const deleteCount = readDefiniteArrayInteger(
                  scoped(1)?.node,
                  args.length < 2 ? Number.POSITIVE_INFINITY : 0,
                  terminal.scope,
                  state
                );
                if (start === undefined || deleteCount === undefined) {
                  return undefined;
                }
                entries.splice(
                  start,
                  Math.max(0, deleteCount),
                  ...args.slice(2).map((argument) => ({
                    node: argument as t.Expression,
                    scope: terminal.scope,
                  }))
                );
              } else {
                return READONLY_ARRAY_TRANSFORMS.has(method)
                  ? value
                  : undefined;
              }
              return value;
            },
          });
          continue;
        }
        if (memberChainIsReadOnly(firstMember)) continue;
        return undefined;
      }
    }

    for (const operation of operations.sort(
      (first, second) => first.position - second.position
    )) {
      snapshot = operation.apply(snapshot);
      if (!snapshot) return undefined;
    }
    return { snapshot, relatedBindings: seenBindings };
  }

  /** Returns whether the exact final finite container contains T anywhere. */
  function readDefiniteFinalContainerHasGT(
    binding: Binding,
    state: ScriptState
  ): boolean | undefined {
    const snapshot = readDefiniteFinalContainerSnapshot(binding, state);
    if (!snapshot) return undefined;
    const values = readFinalContainerValues(snapshot);
    let unknown = false;
    for (const value of values) {
      const hasGT = readDefiniteExpressionHasGT(
        value.node,
        value.scope,
        state,
        new Set()
      );
      if (hasGT) return true;
      if (hasGT === undefined) unknown = true;
    }
    return unknown ? undefined : false;
  }

  /** Lists the concrete values held by a finite container snapshot. */
  function readFinalContainerValues(
    snapshot: FinalContainerSnapshot
  ): ScopedExpression[] {
    return snapshot.kind === 'array'
      ? snapshot.entries.filter(
          (entry): entry is ScopedExpression => entry !== undefined
        )
      : [...snapshot.entries.values()];
  }

  return {
    readDefiniteArrayInteger,
    readDefiniteFinalContainerHasGT,
    readDefiniteFinalContainerSnapshot,
  };
}
