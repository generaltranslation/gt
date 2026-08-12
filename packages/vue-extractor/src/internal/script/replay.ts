import type { Binding, NodePath, Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import {
  appendTemplatePath,
  recursiveTemplatePathSegment,
  unknownTemplatePathSegment,
} from '../templatePath.js';
import type { TemplateContainerKind } from '../types.js';
import { unwrapExpression, type StaticPrimitiveResult } from '../utils.js';
import type {
  ComponentFactoryCandidate,
  ComponentMemberCandidate,
  ContainerIdentityReplay,
  ContainerWrapperKind,
  ContainerWritePolicy,
  KnownValue,
  ReplayCollectionReference,
  ReplayComputedReference,
  ReplayContainerIdentity,
  ReplayContainerReference,
  ReplayContainerSnapshot,
  ReplayEvaluationContext,
  ReplayGetterReference,
  ReplayLeaf,
  ReplayLeafState,
  ReplayMethodReference,
  ReplayRefReference,
  ReplayUnsafe,
  ReplayValue,
  ScopedExpression,
  ScriptState,
  VueScriptAnalysis,
} from './model.js';

/** Static-analysis operations consumed by the source-ordered replay SCC. */
export type ReplayAnalysisDependencies = {
  ordinaryGlobalValues: ReadonlySet<string>;
  readonlyArrayTransforms: ReadonlySet<string>;
  bindingReadsUnsafeMutableImport: (
    binding: Binding,
    state: ScriptState
  ) => boolean;
  collectFunctionReturnExpressions: (
    fn: t.Function,
    scope: Scope,
    state: ScriptState
  ) => ScopedExpression[];
  collectPatternBindingNames: (pattern: t.Node) => string[];
  composeContainerWritePolicy: (
    wrapper: ContainerWrapperKind,
    inner: ContainerWritePolicy | undefined
  ) => ContainerWritePolicy;
  knownValueKey: (value: KnownValue) => string;
  readDefiniteArrayInteger: (
    node: t.Node | undefined,
    fallback: number,
    scope: Scope,
    state: ScriptState
  ) => number | undefined;
  readStaticLogicalSelection: (
    node: t.LogicalExpression,
    scope: Scope,
    state: ScriptState
  ) => 'left' | 'right' | undefined;
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
  readResolvedPropertyKey: (
    property: { computed: boolean; key: t.Node },
    scope: Scope,
    state: ScriptState
  ) => string | undefined;
  readParameterSubstitution: (
    binding: Binding,
    state: ScriptState
  ) => ScopedExpression | undefined;
  readStaticFromScope: (
    node: t.Node | null | undefined,
    scope: Scope,
    seen: Set<Binding>,
    atPosition: number,
    analysis?: VueScriptAnalysis,
    allowNumericGlobals?: boolean
  ) => StaticPrimitiveResult;
  resolveCalledFunction: (
    node: t.Node | null | undefined,
    scope: Scope,
    state: ScriptState,
    seen: Set<t.Node>
  ) => (ScopedExpression & { node: t.Function }) | undefined;
  resolveComputedGetter: (
    node: t.Node,
    scope: Scope,
    state: ScriptState
  ) => (ScopedExpression & { node: t.Function }) | undefined;
  resolveKnownExpression: (
    node: t.Node | null | undefined,
    scope: Scope,
    state: ScriptState,
    seen: Set<Binding>
  ) => KnownValue | undefined;
};

/** Narrow replay queries used by the surrounding script analyzer. */
export type ReplayAnalysis = {
  evaluateReplayAtPosition: (
    node: t.Node,
    scope: Scope,
    atPosition: number,
    state: ScriptState
  ) => ReplayValue | undefined;
  readDefiniteReplayGTContainerPaths: (
    binding: Binding,
    state: ScriptState
  ) => Set<string> | null | undefined;
  readReplayComponentCandidates: (
    binding: Binding,
    basePath: string,
    state: ScriptState
  ) => ComponentMemberCandidate[] | undefined;
  readReplayComponentFactoryCandidates: (
    binding: Binding,
    basePath: string,
    state: ScriptState
  ) => ComponentFactoryCandidate[] | undefined;
  readReplayContainerMetadata: (
    binding: Binding,
    basePath: string,
    state: ScriptState
  ) =>
    | {
        arrayLengths: Map<string, number>;
        kinds: Map<string, TemplateContainerKind>;
      }
    | undefined;
  readReplayLeafState: (
    binding: Binding,
    state: ScriptState
  ) => ReplayLeafState | undefined;
  readSafeReplayLeafOverride: (
    binding: Binding,
    replayLeaf: ReplayLeafState | undefined,
    state: ScriptState
  ) => Extract<ReplayLeafState, { status: 'leaf' }> | undefined;
  isReplayGetterStringLeaf: (value: ReplayLeaf) => boolean;
  replayBindingRetainsUnsafeIdentity: (
    binding: Binding,
    state: ScriptState
  ) => boolean;
  replayMaySelectStringRoleAtPosition: (
    node: t.Node,
    scope: Scope,
    atPosition: number,
    role: 'factory' | 'translator',
    state: ScriptState
  ) => boolean;
};

/**
 * Creates the finite source-ordered identity analyzer used by script analysis.
 * Dependencies are injected so the replay evaluator remains one cohesive SCC
 * without creating a runtime import cycle back to the script orchestrator.
 */
export function createReplayAnalysis({
  ordinaryGlobalValues: ORDINARY_GLOBAL_VALUES,
  readonlyArrayTransforms: READONLY_ARRAY_TRANSFORMS,
  bindingReadsUnsafeMutableImport,
  collectFunctionReturnExpressions,
  collectPatternBindingNames,
  composeContainerWritePolicy,
  knownValueKey,
  readDefiniteArrayInteger,
  readStaticLogicalSelection,
  readResolvedMemberPath,
  readResolvedMemberProperty,
  readResolvedPropertyKey,
  readParameterSubstitution,
  readStaticFromScope,
  resolveCalledFunction,
  resolveComputedGetter,
  resolveKnownExpression,
}: ReplayAnalysisDependencies): ReplayAnalysis {
  const replayUnsafe: ReplayUnsafe = { type: 'unsafe' };

  /** Creates one fresh runtime container identity for source-ordered replay. */
  function createReplayContainer(
    snapshot: ReplayContainerSnapshot
  ): ReplayContainerReference {
    return {
      type: 'container',
      identity: { escaped: false, snapshot },
      writePolicy: 'forward',
    };
  }

  /** Returns a reference with the write behavior Vue applies to one wrapper. */
  function wrapReplayContainer(
    value: ReplayContainerReference,
    wrapper: ContainerWrapperKind
  ): ReplayContainerReference {
    return {
      type: 'container',
      identity: value.identity,
      writePolicy: composeContainerWritePolicy(wrapper, value.writePolicy),
    };
  }

  /** Applies a Vue proxy wrapper to a container, ref, or computed reference. */
  function wrapReplayReference(
    value:
      | ReplayCollectionReference
      | ReplayComputedReference
      | ReplayContainerReference
      | ReplayRefReference,
    wrapper: ContainerWrapperKind
  ):
    | ReplayCollectionReference
    | ReplayComputedReference
    | ReplayContainerReference
    | ReplayRefReference {
    if (value.type === 'container') return wrapReplayContainer(value, wrapper);
    return {
      ...value,
      writePolicy: composeContainerWritePolicy(wrapper, value.writePolicy),
    };
  }

  /** Marks an escaped identity and every nested identity reachable through it. */
  function markReplayContainerEscaped(
    value: ReplayContainerReference,
    seen: Set<object> = new Set()
  ): void {
    if (seen.has(value.identity)) return;
    seen.add(value.identity);
    value.identity.escaped = true;
    const entries =
      value.identity.snapshot.kind === 'array'
        ? value.identity.snapshot.entries
        : value.identity.snapshot.entries.values();
    for (const entry of entries) {
      if (entry?.type === 'container') markReplayContainerEscaped(entry, seen);
      if (entry?.type === 'ref') markReplayRefEscaped(entry, seen);
      if (entry?.type === 'collection') {
        markReplayCollectionEscaped(entry, seen);
      }
    }
    if (value.identity.snapshot.kind === 'object') {
      const prototype = value.identity.snapshot.prototype;
      if (prototype) markReplayContainerEscaped(prototype, seen);
    }
  }

  /** Marks a ref and every container reachable through its current value unsafe. */
  function markReplayRefEscaped(
    value: ReplayRefReference,
    seen: Set<object> = new Set()
  ): void {
    if (seen.has(value.identity)) return;
    seen.add(value.identity);
    value.identity.escaped = true;
    const current = value.identity.value;
    if (current?.type === 'container')
      markReplayContainerEscaped(current, seen);
    if (current?.type === 'ref') markReplayRefEscaped(current, seen);
    if (current?.type === 'collection') {
      markReplayCollectionEscaped(current, seen);
    }
  }

  /** Marks a Map or Set abstraction unsafe after an unmodelled escape. */
  function markReplayCollectionEscaped(
    value: ReplayCollectionReference,
    seen: Set<object> = new Set()
  ): void {
    if (seen.has(value.identity)) return;
    seen.add(value.identity);
    value.identity.escaped = true;
    for (const entry of value.identity.entries.values()) {
      if (entry.type === 'container') markReplayContainerEscaped(entry, seen);
      if (entry.type === 'ref') markReplayRefEscaped(entry, seen);
      if (entry.type === 'collection') markReplayCollectionEscaped(entry, seen);
    }
  }

  /** Marks any mutable replay value unsafe after an unsupported operation. */
  function markReplayValueEscaped(value: ReplayValue | undefined): void {
    if (value?.type === 'container') markReplayContainerEscaped(value);
    if (value?.type === 'ref') markReplayRefEscaped(value);
    if (value?.type === 'collection') markReplayCollectionEscaped(value);
    if (value?.type === 'function') {
      for (const captured of value.substitutions.values()) {
        markReplayValueEscaped(captured);
      }
      for (const captured of value.boundArguments) {
        markReplayValueEscaped(captured);
      }
    }
  }

  /** Reads a ref value through the proxy policy currently wrapping the ref. */
  function readReplayRefValue(
    value: ReplayRefReference
  ): ReplayValue | undefined {
    if (value.identity.escaped) return replayUnsafe;
    const current = value.identity.value;
    if (
      current?.type === 'collection' ||
      current?.type === 'container' ||
      current?.type === 'ref' ||
      current?.type === 'computed'
    ) {
      if (value.writePolicy === 'readonly-deep') {
        return wrapReplayReference(current, 'readonly');
      }
    }
    return current?.type === 'leaf'
      ? { ...current, exactSelection: true, selectionKind: 'ref' }
      : current;
  }

  /** Applies Vue's deep readonly conversion to a value read through a proxy. */
  function wrapReplayReadValue(
    value: ReplayValue | undefined,
    policy: ContainerWritePolicy
  ): ReplayValue | undefined {
    if (
      value &&
      policy === 'readonly-deep' &&
      (value.type === 'collection' ||
        value.type === 'computed' ||
        value.type === 'container' ||
        value.type === 'ref')
    ) {
      return wrapReplayReference(value, 'readonly');
    }
    return value;
  }

  /** Evaluates a supported property getter against the current replay state. */
  function evaluateReplayGetter(
    value: ReplayGetterReference,
    receiver: ReplayContainerReference,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    if (!context.allowGetterEffects) {
      const body = value.getter.node.body;
      if (
        body.type === 'BlockStatement' &&
        (body.body.length !== 1 || body.body[0]?.type !== 'ReturnStatement')
      ) {
        return undefined;
      }
      const returns = collectFunctionReturnExpressions(
        value.getter.node,
        value.getter.scope,
        state
      );
      return returns.length === 1
        ? evaluateReplayExpression(returns[0]!.node, returns[0]!.scope, state, {
            ...context,
            substitutions: new Map(value.substitutions),
            thisValue: receiver,
          })
        : undefined;
    }
    const result = executeReplayFunction(
      value.getter,
      [],
      state,
      {
        ...context,
        substitutions: new Map(value.substitutions),
        thisValue: receiver,
      },
      receiver
    );
    return result.executed ? result.value : undefined;
  }

  /** Reads a child using prototype lookup and Vue proxy conversion rules. */
  function readReplayContainerEntry(
    value: ReplayContainerReference,
    property: string,
    state: ScriptState,
    context: ReplayEvaluationContext,
    seen: Set<ReplayContainerIdentity> = new Set(),
    receiver: ReplayContainerReference = value
  ): ReplayValue | undefined {
    if (value.identity.escaped || seen.has(value.identity)) return replayUnsafe;
    const snapshot = value.identity.snapshot;
    let entry: ReplayValue | undefined;
    if (snapshot.kind === 'array') {
      entry = /^(0|[1-9]\d*)$/.test(property)
        ? snapshot.entries[Number(property)]
        : undefined;
    } else if (snapshot.entries.has(property)) {
      entry = snapshot.entries.get(property);
    } else if (snapshot.prototype) {
      entry = readReplayContainerEntry(
        snapshot.prototype,
        property,
        state,
        context,
        new Set(seen).add(value.identity),
        receiver
      );
    }
    let fromGetter = false;
    if (entry?.type === 'getter') {
      fromGetter = true;
      entry = evaluateReplayGetter(entry, receiver, state, context);
    }
    if (entry?.type === 'method') {
      entry = { ...entry, receiver };
    }
    if (entry?.type === 'leaf') {
      entry = {
        ...entry,
        exactSelection: true,
        selectionKind: fromGetter ? 'getter' : 'member',
      };
    }
    return wrapReplayReadValue(entry, value.writePolicy);
  }

  /** Lists the property names visible through a finite object prototype chain. */
  function readReplayVisibleObjectKeys(
    value: ReplayContainerReference,
    seen: Set<ReplayContainerIdentity> = new Set()
  ): Set<string> | undefined {
    if (
      value.identity.escaped ||
      value.identity.snapshot.kind !== 'object' ||
      seen.has(value.identity)
    ) {
      return undefined;
    }
    const keys = value.identity.snapshot.prototype
      ? readReplayVisibleObjectKeys(
          value.identity.snapshot.prototype,
          new Set(seen).add(value.identity)
        )
      : new Set<string>();
    if (!keys) return undefined;
    for (const key of value.identity.snapshot.entries.keys()) keys.add(key);
    return keys;
  }

  /** Lists every value a template can select from one finite container. */
  function readReplayVisibleContainerEntries(
    value: ReplayContainerReference,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): Array<readonly [string, ReplayValue | undefined]> | undefined {
    if (value.identity.escaped) return undefined;
    const snapshot = value.identity.snapshot;
    if (snapshot.kind === 'array') {
      return snapshot.entries.map((entry, index) => [String(index), entry]);
    }
    const keys = readReplayVisibleObjectKeys(value);
    if (!keys) return undefined;
    const entries: Array<readonly [string, ReplayValue]> = [];
    for (const key of keys) {
      const entry = readReplayContainerEntry(value, key, state, context);
      if (!entry) return undefined;
      entries.push([key, entry]);
    }
    return entries;
  }

  /** Resolves whether a non-container value is definitely `<T>` at this point. */
  function createReplayLeaf(
    node: t.Node,
    scope: Scope,
    state: ScriptState
  ): ReplayLeaf {
    const expression = unwrapExpression(node) ?? node;
    const known = resolveKnownExpression(expression, scope, state, new Set());
    const knownValue =
      known?.type === 'component' ||
      known?.type === 'string' ||
      known?.type === 'vue-builtin'
        ? known
        : undefined;
    if (known) {
      return {
        type: 'leaf',
        expression: { node: expression, scope },
        hasGT: known.type === 'component' && known.name === 'T',
        knownValue,
        stringRole:
          known.type === 'hook'
            ? 'factory'
            : known.type === 'string'
              ? 'translator'
              : undefined,
      };
    }
    const primitive = readStaticFromScope(
      expression,
      scope,
      new Set(),
      expression.end ?? Number.POSITIVE_INFINITY,
      state.analysis
    );
    const ordinaryGlobal =
      expression.type === 'Identifier' &&
      !scope.getBinding(expression.name) &&
      ORDINARY_GLOBAL_VALUES.has(expression.name);
    return {
      type: 'leaf',
      expression: { node: expression, scope },
      hasGT: primitive.ok || ordinaryGlobal ? false : undefined,
      knownValue,
    };
  }

  /** Reads a statically named member chain from a replayed container. */
  function evaluateReplayMember(
    node: t.MemberExpression | t.OptionalMemberExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const object = evaluateReplayExpression(node.object, scope, state, context);
    const property = readResolvedMemberProperty(node, scope, state);
    if (property === undefined) return undefined;
    if (object?.type === 'unsafe') return object;
    if (object?.type === 'container') {
      return readReplayContainerEntry(object, property, state, context);
    }
    if (property !== 'value') return undefined;
    if (object?.type === 'ref') return readReplayRefValue(object);
    if (object?.type === 'computed') {
      return evaluateReplayComputed(object, state, context);
    }
    return undefined;
  }

  /** Shallow-copies the enumerable own entries of one container reference. */
  function copyReplayContainerEntries(
    value: ReplayContainerReference,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayContainerSnapshot | undefined {
    if (value.identity.escaped) return undefined;
    const snapshot = value.identity.snapshot;
    if (snapshot.kind === 'array') {
      return {
        kind: 'array',
        entries: snapshot.entries.map((_entry, index) =>
          readReplayContainerEntry(value, String(index), state, context)
        ),
      };
    }
    return {
      kind: 'object',
      entries: new Map(
        [...snapshot.entries.keys()].flatMap((key) => {
          const entry = readReplayContainerEntry(value, key, state, context);
          return entry ? [[key, entry] as const] : [];
        })
      ),
    };
  }

  /** Evaluates one finite array literal without losing nested object identity. */
  function evaluateReplayArray(
    node: t.ArrayExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayContainerReference | ReplayUnsafe | undefined {
    const entries: Array<ReplayValue | undefined> = [];
    for (const element of node.elements) {
      if (!element) {
        entries.push(undefined);
        continue;
      }
      if (element.type === 'SpreadElement') {
        const spread = evaluateReplayExpression(
          element.argument,
          scope,
          state,
          context
        );
        if (spread?.type === 'unsafe') return spread;
        if (spread?.type === 'container' && spread.identity.escaped) {
          return replayUnsafe;
        }
        if (
          spread?.type !== 'container' ||
          spread.identity.snapshot.kind !== 'array'
        ) {
          return undefined;
        }
        const copied = copyReplayContainerEntries(spread, state, context);
        if (!copied || copied.kind !== 'array') return undefined;
        entries.push(...copied.entries);
        continue;
      }
      entries.push(evaluateReplayExpression(element, scope, state, context));
    }
    return createReplayContainer({ kind: 'array', entries });
  }

  /** Evaluates one finite object literal with JavaScript shallow-spread semantics. */
  function evaluateReplayObject(
    node: t.ObjectExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayContainerReference | ReplayUnsafe | undefined {
    const entries = new Map<string, ReplayValue>();
    const setters = new Map<string, ReplayMethodReference>();
    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        const spread = evaluateReplayExpression(
          property.argument,
          scope,
          state,
          context
        );
        if (spread?.type === 'unsafe') return spread;
        if (spread?.type === 'container' && spread.identity.escaped) {
          return replayUnsafe;
        }
        if (
          spread?.type !== 'container' ||
          spread.identity.snapshot.kind !== 'object'
        ) {
          return undefined;
        }
        const copied = copyReplayContainerEntries(spread, state, context);
        if (!copied || copied.kind !== 'object') return undefined;
        for (const [key, value] of copied.entries) entries.set(key, value);
        continue;
      }
      if (property.type === 'ObjectMethod' && property.kind === 'get') {
        const key = readResolvedPropertyKey(property, scope, state);
        if (key === undefined) return undefined;
        entries.set(key, {
          type: 'getter',
          getter: {
            node: property,
            scope: state.scopes.get(property) ?? scope,
          },
          substitutions: new Map(context.substitutions),
        });
        continue;
      }
      if (property.type === 'ObjectMethod' && property.kind === 'method') {
        const key = readResolvedPropertyKey(property, scope, state);
        if (key === undefined) return undefined;
        entries.set(key, {
          type: 'method',
          callable: {
            node: property,
            scope: state.scopes.get(property) ?? scope,
          },
          substitutions: new Map(context.substitutions),
        });
        continue;
      }
      if (property.type === 'ObjectMethod' && property.kind === 'set') {
        const key = readResolvedPropertyKey(property, scope, state);
        if (key === undefined) return undefined;
        setters.set(key, {
          type: 'method',
          callable: {
            node: property,
            scope: state.scopes.get(property) ?? scope,
          },
          substitutions: new Map(context.substitutions),
        });
        continue;
      }
      if (property.type !== 'ObjectProperty') return undefined;
      const key = readResolvedPropertyKey(property, scope, state);
      if (key === undefined) return undefined;
      const value = evaluateReplayExpression(
        property.value,
        scope,
        state,
        context
      );
      if (!value) return undefined;
      entries.set(key, value);
    }
    return createReplayContainer({ kind: 'object', entries, setters });
  }

  /** Evaluates a computed getter against the current, not captured, bindings. */
  function evaluateReplayComputed(
    value: ReplayComputedReference,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const returns = collectFunctionReturnExpressions(
      value.getter.node,
      value.getter.scope,
      state
    );
    if (returns.length !== 1) return undefined;
    const result = evaluateReplayExpression(
      returns[0]!.node,
      returns[0]!.scope,
      state,
      context
    );
    return result &&
      (result.type === 'collection' ||
        result.type === 'container' ||
        result.type === 'ref' ||
        result.type === 'computed')
      ? wrapReplayReference(
          result,
          value.writePolicy === 'readonly-deep'
            ? 'readonly'
            : value.writePolicy === 'readonly-shallow'
              ? 'shallow-readonly'
              : 'unref'
        )
      : result;
  }

  /** Evaluates an expression while applying its supported direct side effects. */
  function executeReplayExpression(
    node: t.Expression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const expression = unwrapExpression(node);
    if (
      expression?.type === 'UnaryExpression' &&
      expression.operator === 'delete' &&
      (expression.argument.type === 'MemberExpression' ||
        expression.argument.type === 'OptionalMemberExpression')
    ) {
      return applyReplayMemberDelete(expression.argument, scope, state, context)
        ? createReplayLeaf(expression, scope, state)
        : undefined;
    }
    if (expression?.type !== 'AssignmentExpression') {
      return evaluateReplayExpression(node, scope, state, context);
    }
    if (expression.operator !== '=') return undefined;
    const replacement = evaluateReplayExpression(
      expression.right,
      scope,
      state,
      context
    );
    if (expression.left.type === 'Identifier') {
      const binding = scope.getBinding(expression.left.name);
      if (binding) {
        if (replacement?.type === 'unsafe') context.unsafeBindings.add(binding);
        else context.unsafeBindings.delete(binding);
        context.values.set(binding, replacement);
      }
      return replacement;
    }
    if (
      expression.left.type === 'MemberExpression' ||
      expression.left.type === 'OptionalMemberExpression'
    ) {
      return applyReplayMemberAssignment(
        expression.left,
        expression.right,
        scope,
        state,
        context
      )
        ? replacement
        : undefined;
    }
    return undefined;
  }

  /** Executes one finite local function body with captured identities intact. */
  function executeReplayFunction(
    callable: ScopedExpression & { node: t.Function },
    arguments_: ReplayValue[],
    state: ScriptState,
    context: ReplayEvaluationContext,
    thisValue: ReplayValue | undefined = context.thisValue
  ): { executed: boolean; value: ReplayValue | undefined } {
    if (state.activeReplayFunctions.has(callable.node)) {
      return { executed: false, value: undefined };
    }
    const functionScope = state.scopes.get(callable.node) ?? callable.scope;
    const substitutions = new Map(context.substitutions);
    for (const [index, parameter] of callable.node.params.entries()) {
      const name =
        parameter.type === 'Identifier'
          ? parameter.name
          : parameter.type === 'RestElement' &&
              parameter.argument.type === 'Identifier'
            ? parameter.argument.name
            : undefined;
      if (!name) return { executed: false, value: undefined };
      const binding = functionScope.getBinding(name);
      if (!binding) return { executed: false, value: undefined };
      if (parameter.type === 'RestElement') {
        substitutions.set(
          binding,
          createReplayContainer({
            kind: 'array',
            entries: arguments_.slice(index),
          })
        );
        break;
      }
      const argument = arguments_[index];
      if (!argument) return { executed: false, value: undefined };
      substitutions.set(binding, argument);
    }
    const localContext = {
      ...context,
      substitutions,
      thisValue,
    };
    state.activeReplayFunctions.add(callable.node);
    try {
      if (callable.node.body.type !== 'BlockStatement') {
        return {
          executed: true,
          value: executeReplayExpression(
            callable.node.body,
            functionScope,
            state,
            localContext
          ),
        };
      }
      const bodyPath = state.paths.get(callable.node.body);
      const statements = bodyPath?.isBlockStatement()
        ? bodyPath.get('body')
        : undefined;
      if (!statements || !Array.isArray(statements)) {
        return { executed: false, value: undefined };
      }
      for (const statement of statements) {
        if (statement.isReturnStatement()) {
          return {
            executed: true,
            value: statement.node.argument
              ? executeReplayExpression(
                  statement.node.argument,
                  statement.scope,
                  state,
                  localContext
                )
              : undefined,
          };
        }
        if (
          !statement.isVariableDeclaration() &&
          !statement.isExpressionStatement()
        ) {
          return { executed: false, value: undefined };
        }
        replayContainerStatement(
          statement as NodePath<t.Node>,
          state,
          localContext
        );
      }
      return { executed: true, value: undefined };
    } finally {
      state.activeReplayFunctions.delete(callable.node);
    }
  }

  /** Reads one exact callback return for array transform replay. */
  function evaluateReplayCallback(
    callback: ScopedExpression & { node: t.Function },
    argument: ReplayValue,
    source: ReplayContainerReference,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const result = executeReplayFunction(callback, [argument], state, context);
    if (!result.executed) {
      invalidateReplayFunctionCaptures(callback.node, state, context);
      markReplayContainerEscaped(source);
      return undefined;
    }
    return result.value;
  }

  /** Detects writes hidden inside an expression-bodied callback. */
  function replayExpressionHasWrites(
    node: t.Node,
    state: ScriptState
  ): boolean {
    const path = state.paths.get(node);
    if (!path) return true;
    let writes = false;
    const mark = (candidate: NodePath<t.Node>): void => {
      writes = true;
      candidate.stop();
    };
    path.traverse({
      AssignmentExpression: mark,
      UpdateExpression: mark,
      UnaryExpression(candidate) {
        if (candidate.node.operator === 'delete') mark(candidate);
      },
    });
    return writes;
  }

  /** Applies a finite array copy transform at the exact call position. */
  function evaluateReplayArrayTransform(
    value: ReplayContainerReference,
    method: string,
    call: t.CallExpression | t.OptionalCallExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayContainerReference | ReplayUnsafe | undefined {
    if (value.identity.escaped) return replayUnsafe;
    if (value.identity.snapshot.kind !== 'array') return undefined;
    if (
      call.arguments.some(
        (argument) =>
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
      )
    ) {
      return undefined;
    }
    const copied = copyReplayContainerEntries(value, state, context);
    if (!copied || copied.kind !== 'array') return undefined;
    const entries = copied.entries;
    const argumentNode = (index: number): t.Expression | undefined => {
      const argument = call.arguments[index];
      return argument && argument.type !== 'ArgumentPlaceholder'
        ? (argument as t.Expression)
        : undefined;
    };
    if (method === 'slice') {
      const start = readDefiniteArrayInteger(argumentNode(0), 0, scope, state);
      const end = readDefiniteArrayInteger(
        argumentNode(1),
        entries.length,
        scope,
        state
      );
      return start === undefined || end === undefined
        ? undefined
        : createReplayContainer({
            kind: 'array',
            entries: entries.slice(start, end),
          });
    }
    if (method === 'concat') {
      for (const argument of call.arguments) {
        const item = evaluateReplayExpression(
          argument as t.Expression,
          scope,
          state,
          context
        );
        if (!item) return undefined;
        if (
          item.type === 'container' &&
          item.identity.snapshot.kind === 'array'
        ) {
          const flattened = copyReplayContainerEntries(item, state, context);
          if (!flattened || flattened.kind !== 'array') return undefined;
          entries.push(...flattened.entries);
        } else {
          entries.push(item);
        }
      }
      return createReplayContainer({ kind: 'array', entries });
    }
    if (method === 'map') {
      const callbackNode = argumentNode(0);
      const callback = callbackNode
        ? resolveCalledFunction(callbackNode, scope, state, new Set())
        : undefined;
      if (!callback) return undefined;
      const mapped: Array<ReplayValue | undefined> = [];
      for (const entry of entries) {
        if (!entry) {
          mapped.push(undefined);
          continue;
        }
        const result = evaluateReplayCallback(
          callback,
          entry,
          value,
          state,
          context
        );
        if (!result) return undefined;
        mapped.push(result);
      }
      return createReplayContainer({ kind: 'array', entries: mapped });
    }
    if (method === 'toSpliced') {
      const start = readDefiniteArrayInteger(argumentNode(0), 0, scope, state);
      const deleteCount = readDefiniteArrayInteger(
        argumentNode(1),
        call.arguments.length === 0
          ? 0
          : call.arguments.length === 1
            ? entries.length
            : 0,
        scope,
        state
      );
      if (start === undefined || deleteCount === undefined) return undefined;
      const inserted: ReplayValue[] = [];
      for (const argument of call.arguments.slice(2)) {
        const item = evaluateReplayExpression(
          argument as t.Expression,
          scope,
          state,
          context
        );
        if (!item) return undefined;
        inserted.push(item);
      }
      entries.splice(start, Math.max(0, deleteCount), ...inserted);
      return createReplayContainer({ kind: 'array', entries });
    }
    if (method === 'toReversed') {
      return createReplayContainer({
        kind: 'array',
        entries: entries.reverse(),
      });
    }
    if (method === 'toSorted') {
      return entries.length <= 1
        ? createReplayContainer({ kind: 'array', entries })
        : undefined;
    }
    if (method === 'with') {
      const index = readDefiniteArrayInteger(argumentNode(0), 0, scope, state);
      const replacement = argumentNode(1);
      if (index === undefined || !replacement) return undefined;
      const normalized = index < 0 ? entries.length + index : index;
      if (normalized < 0 || normalized >= entries.length) return undefined;
      const item = evaluateReplayExpression(replacement, scope, state, context);
      if (!item) return undefined;
      entries[normalized] = item;
      return createReplayContainer({ kind: 'array', entries });
    }
    return undefined;
  }

  /** Mutates one replayed array when the built-in operation is deterministic. */
  function applyReplayArrayMutation(
    value: ReplayContainerReference,
    method: string,
    call: t.CallExpression | t.OptionalCallExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): boolean {
    if (value.identity.snapshot.kind !== 'array') return false;
    if (value.writePolicy !== 'forward') return true;
    if (
      call.arguments.some(
        (argument) =>
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
      )
    ) {
      markReplayContainerEscaped(value);
      return false;
    }
    const entries = value.identity.snapshot.entries;
    const evaluated = call.arguments.map((argument) =>
      evaluateReplayExpression(argument as t.Expression, scope, state, context)
    );
    if (evaluated.some((entry) => !entry)) {
      markReplayContainerEscaped(value);
      return false;
    }
    const items = evaluated as ReplayValue[];
    if (method === 'pop') entries.pop();
    else if (method === 'shift') entries.shift();
    else if (method === 'push') entries.push(...items);
    else if (method === 'unshift') entries.unshift(...items);
    else if (method === 'splice') {
      const first = call.arguments[0] as t.Expression | undefined;
      const second = call.arguments[1] as t.Expression | undefined;
      const start = readDefiniteArrayInteger(first, 0, scope, state);
      const deleteCount = readDefiniteArrayInteger(
        second,
        call.arguments.length === 0
          ? 0
          : call.arguments.length === 1
            ? entries.length
            : 0,
        scope,
        state
      );
      if (start === undefined || deleteCount === undefined) {
        markReplayContainerEscaped(value);
        return false;
      }
      entries.splice(start, Math.max(0, deleteCount), ...items.slice(2));
    } else {
      return false;
    }
    return true;
  }

  /** Evaluates known wrappers, transforms, and mutators in source order. */
  function evaluateReplayCall(
    node: t.CallExpression | t.OptionalCallExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const wrapper = resolveKnownExpression(
      node.callee,
      scope,
      state,
      new Set()
    );
    const first = node.arguments[0];
    if (
      wrapper?.type === 'container-wrapper' &&
      first &&
      first.type !== 'ArgumentPlaceholder' &&
      first.type !== 'SpreadElement'
    ) {
      const value = evaluateReplayExpression(first, scope, state, context);
      if (value?.type === 'unsafe') return value;
      if (wrapper.kind === 'unref') {
        if (value?.type === 'ref') return readReplayRefValue(value);
        if (value?.type === 'computed') {
          return evaluateReplayComputed(value, state, context);
        }
        return value;
      }
      return value &&
        (value.type === 'container' ||
          value.type === 'collection' ||
          value.type === 'ref' ||
          value.type === 'computed')
        ? wrapReplayReference(value, wrapper.kind)
        : undefined;
    }
    if (
      wrapper?.type === 'identity' &&
      first &&
      first.type !== 'ArgumentPlaceholder' &&
      first.type !== 'SpreadElement'
    ) {
      return evaluateReplayExpression(first, scope, state, context);
    }
    if (wrapper?.type === 'vue-wrapper' && wrapper.kind === 'ref') {
      const initial =
        first &&
        first.type !== 'ArgumentPlaceholder' &&
        first.type !== 'SpreadElement'
          ? evaluateReplayExpression(first, scope, state, context)
          : createReplayLeaf(node, scope, state);
      return {
        type: 'ref',
        identity: { escaped: false, value: initial },
        writePolicy: 'forward',
      };
    }
    if (wrapper?.type === 'vue-wrapper' && wrapper.kind === 'computed') {
      const getter =
        first &&
        first.type !== 'ArgumentPlaceholder' &&
        first.type !== 'SpreadElement'
          ? resolveComputedGetter(first, scope, state)
          : undefined;
      return getter
        ? { type: 'computed', getter, writePolicy: 'forward' }
        : undefined;
    }
    if (wrapper?.type === 'hook') {
      return createReplayLeaf(node, scope, state);
    }

    const calleePath = readResolvedMemberPath(node.callee, scope, state);
    if (calleePath === 'Object.values' && !scope.getBinding('Object')) {
      if (
        !first ||
        first.type === 'ArgumentPlaceholder' ||
        first.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const source = evaluateReplayExpression(first, scope, state, context);
      const entries =
        source?.type === 'container'
          ? readReplayVisibleContainerEntries(source, state, context)
          : undefined;
      return entries
        ? createReplayContainer({
            kind: 'array',
            entries: entries.map(([, value]) => value),
          })
        : undefined;
    }
    if (calleePath === 'Array.from' && !scope.getBinding('Array')) {
      if (
        node.arguments.length > 1 ||
        !first ||
        first.type === 'ArgumentPlaceholder' ||
        first.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const source = evaluateReplayExpression(first, scope, state, context);
      if (source?.type === 'unsafe') return source;
      if (source?.type === 'collection') {
        if (source.identity.escaped) return replayUnsafe;
        if (source.identity.kind === 'map' && source.iteration === 'entries') {
          return undefined;
        }
        return createReplayContainer({
          kind: 'array',
          entries: [...source.identity.entries.values()],
        });
      }
      if (
        source?.type !== 'container' ||
        source.identity.snapshot.kind !== 'array'
      ) {
        return undefined;
      }
      if (source.identity.escaped) return replayUnsafe;
      const copied = copyReplayContainerEntries(source, state, context);
      return copied?.kind === 'array'
        ? createReplayContainer(copied)
        : undefined;
    }
    if (calleePath === 'Object.assign' && !scope.getBinding('Object')) {
      if (
        !first ||
        first.type === 'ArgumentPlaceholder' ||
        first.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const target = evaluateReplayExpression(first, scope, state, context);
      if (
        target?.type !== 'container' ||
        target.identity.snapshot.kind !== 'object'
      ) {
        return undefined;
      }
      if (target.writePolicy !== 'forward') return target;
      for (const argument of node.arguments.slice(1)) {
        if (
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
        ) {
          markReplayContainerEscaped(target);
          return undefined;
        }
        const source = evaluateReplayExpression(
          argument,
          scope,
          state,
          context
        );
        if (source?.type === 'unsafe') {
          markReplayContainerEscaped(target);
          return target;
        }
        if (
          source?.type !== 'container' ||
          source.identity.snapshot.kind !== 'object'
        ) {
          markReplayContainerEscaped(target);
          return undefined;
        }
        if (source.identity.escaped) {
          markReplayContainerEscaped(target);
          return target;
        }
        const copied = copyReplayContainerEntries(source, state, context);
        if (!copied || copied.kind !== 'object') return undefined;
        for (const [key, value] of copied.entries) {
          target.identity.snapshot.entries.set(key, value);
        }
      }
      return target;
    }
    if (calleePath === 'Object.create' && !scope.getBinding('Object')) {
      if (
        !first ||
        first.type === 'ArgumentPlaceholder' ||
        first.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const prototype = evaluateReplayExpression(first, scope, state, context);
      if (
        prototype?.type !== 'container' ||
        prototype.identity.snapshot.kind !== 'object'
      ) {
        return undefined;
      }
      return createReplayContainer({
        kind: 'object',
        entries: new Map(),
        prototype,
      });
    }
    if (calleePath === 'Object.setPrototypeOf' && !scope.getBinding('Object')) {
      const prototypeNode = node.arguments[1];
      if (
        !first ||
        first.type === 'ArgumentPlaceholder' ||
        first.type === 'SpreadElement' ||
        !prototypeNode ||
        prototypeNode.type === 'ArgumentPlaceholder' ||
        prototypeNode.type === 'SpreadElement'
      ) {
        return undefined;
      }
      const target = evaluateReplayExpression(first, scope, state, context);
      const prototype = evaluateReplayExpression(
        prototypeNode,
        scope,
        state,
        context
      );
      if (
        target?.type !== 'container' ||
        target.identity.snapshot.kind !== 'object' ||
        target.writePolicy !== 'forward' ||
        prototype?.type !== 'container' ||
        prototype.identity.snapshot.kind !== 'object'
      ) {
        return undefined;
      }
      target.identity.snapshot.prototype = prototype;
      return target;
    }

    const replayCallee = evaluateReplayExpression(
      node.callee,
      scope,
      state,
      context
    );
    if (
      replayCallee?.type === 'leaf' &&
      (replayCallee.knownValue?.type === 'string' ||
        (replayCallee.expression.node.type === 'Identifier' &&
          !replayCallee.expression.scope.getBinding(
            replayCallee.expression.node.name
          ) &&
          ORDINARY_GLOBAL_VALUES.has(replayCallee.expression.node.name)))
    ) {
      return {
        type: 'leaf',
        expression: { node, scope },
        hasGT: false,
      };
    }
    if (replayCallee?.type === 'function') {
      const arguments_: ReplayValue[] = [];
      for (const argument of node.arguments) {
        if (
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
        ) {
          markReplayValueEscaped(replayCallee);
          return undefined;
        }
        const value = evaluateReplayExpression(argument, scope, state, context);
        if (!value) {
          markReplayValueEscaped(replayCallee);
          return undefined;
        }
        arguments_.push(value);
      }
      const result = executeReplayFunction(
        replayCallee.callable,
        [...replayCallee.boundArguments, ...arguments_],
        state,
        {
          ...context,
          substitutions: new Map(replayCallee.substitutions),
        },
        replayCallee.thisValue
      );
      if (!result.executed) {
        markReplayValueEscaped(replayCallee);
        for (const argument of arguments_) markReplayValueEscaped(argument);
        return undefined;
      }
      return result.value ?? createReplayLeaf(node, scope, state);
    }
    if (replayCallee?.type === 'method' && replayCallee.receiver) {
      const arguments_: ReplayValue[] = [];
      for (const argument of node.arguments) {
        if (
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
        ) {
          markReplayContainerEscaped(replayCallee.receiver);
          return undefined;
        }
        const value = evaluateReplayExpression(argument, scope, state, context);
        if (!value) {
          markReplayContainerEscaped(replayCallee.receiver);
          return undefined;
        }
        arguments_.push(value);
      }
      const result = executeReplayFunction(
        replayCallee.callable,
        arguments_,
        state,
        {
          ...context,
          substitutions: new Map(replayCallee.substitutions),
        },
        replayCallee.receiver
      );
      if (!result.executed) {
        markReplayContainerEscaped(replayCallee.receiver);
        return undefined;
      }
      return result.value ?? createReplayLeaf(node, scope, state);
    }

    const localFunction = resolveCalledFunction(
      node.callee,
      scope,
      state,
      new Set()
    );
    if (localFunction) {
      const arguments_: ReplayValue[] = [];
      for (const argument of node.arguments) {
        if (
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
        ) {
          invalidateReplayFunctionCaptures(localFunction.node, state, context);
          return undefined;
        }
        const value = evaluateReplayExpression(argument, scope, state, context);
        if (!value) {
          invalidateReplayFunctionCaptures(localFunction.node, state, context);
          return undefined;
        }
        arguments_.push(value);
      }
      const result = executeReplayFunction(
        localFunction,
        arguments_,
        state,
        context
      );
      if (result.executed) {
        return result.value ?? createReplayLeaf(node, scope, state);
      }
      for (const argument of arguments_) markReplayValueEscaped(argument);
      invalidateReplayFunctionCaptures(localFunction.node, state, context);
      return undefined;
    }

    const callee = unwrapExpression(node.callee);
    if (
      callee?.type === 'MemberExpression' ||
      callee?.type === 'OptionalMemberExpression'
    ) {
      const value = evaluateReplayExpression(
        callee.object,
        scope,
        state,
        context
      );
      const method = readResolvedMemberProperty(callee, scope, state);
      if (value?.type === 'collection' && method) {
        if (value.identity.escaped) return replayUnsafe;
        if (method === 'values') return { ...value, iteration: 'values' };
        const firstArgument = node.arguments[0];
        const keyValue =
          firstArgument &&
          firstArgument.type !== 'ArgumentPlaceholder' &&
          firstArgument.type !== 'SpreadElement'
            ? evaluateReplayExpression(firstArgument, scope, state, context)
            : undefined;
        const key = keyValue ? replayCollectionKey(keyValue, state) : undefined;
        if (method === 'get' && value.identity.kind === 'map') {
          const entry =
            key === undefined ? undefined : value.identity.entries.get(key);
          return entry?.type === 'leaf'
            ? {
                ...entry,
                exactSelection: true,
                selectionKind: 'collection',
              }
            : entry;
        }
        if (method === 'set' && value.identity.kind === 'map') {
          if (value.writePolicy !== 'forward') return value;
          const next = node.arguments[1];
          const entry =
            next &&
            next.type !== 'ArgumentPlaceholder' &&
            next.type !== 'SpreadElement'
              ? evaluateReplayExpression(next, scope, state, context)
              : undefined;
          if (key === undefined || !entry) {
            markReplayCollectionEscaped(value);
            return undefined;
          }
          value.identity.entries.set(key, entry);
          const templateKey = keyValue
            ? replayCollectionTemplateKey(keyValue, context, state)
            : undefined;
          if (templateKey !== undefined) {
            value.identity.templateKeys.set(key, templateKey);
          }
          return value;
        }
        if (method === 'add' && value.identity.kind === 'set' && keyValue) {
          if (value.writePolicy !== 'forward') return value;
          value.identity.entries.set(
            key ?? `entry:${value.identity.entries.size}`,
            keyValue
          );
          return value;
        }
        if (method === 'delete' && key !== undefined) {
          if (value.writePolicy !== 'forward') {
            return createReplayLeaf(node, scope, state);
          }
          value.identity.entries.delete(key);
          value.identity.templateKeys.delete(key);
          return createReplayLeaf(node, scope, state);
        }
        markReplayCollectionEscaped(value);
        return undefined;
      }
      if (value?.type === 'container' && method) {
        const transformed = evaluateReplayArrayTransform(
          value,
          method,
          node,
          scope,
          state,
          context
        );
        if (transformed) return transformed;
        const callbackNode = node.arguments[0];
        const callback =
          callbackNode &&
          callbackNode.type !== 'ArgumentPlaceholder' &&
          callbackNode.type !== 'SpreadElement'
            ? resolveCalledFunction(callbackNode, scope, state, new Set())
            : undefined;
        if (
          callback &&
          method === 'forEach' &&
          value.identity.snapshot.kind === 'array'
        ) {
          for (const entry of value.identity.snapshot.entries) {
            if (!entry) continue;
            const result = executeReplayFunction(
              callback,
              [entry],
              state,
              context
            );
            if (!result.executed) {
              invalidateReplayFunctionCaptures(callback.node, state, context);
              markReplayContainerEscaped(value);
              return undefined;
            }
          }
          return createReplayLeaf(node, scope, state);
        }
        if (
          callback &&
          [
            'every',
            'filter',
            'find',
            'findIndex',
            'findLast',
            'findLastIndex',
            'flatMap',
            'forEach',
            'reduce',
            'reduceRight',
            'some',
          ].includes(method)
        ) {
          invalidateReplayFunctionCaptures(callback.node, state, context);
          const body = callback.node.body;
          if (
            (body.type !== 'BlockStatement' &&
              replayExpressionHasWrites(body, state)) ||
            (body.type === 'BlockStatement' &&
              body.body.some(
                (statement) => statement.type !== 'ReturnStatement'
              ))
          ) {
            markReplayContainerEscaped(value);
          }
        }
        if (
          ['pop', 'push', 'shift', 'splice', 'unshift'].includes(method) &&
          applyReplayArrayMutation(value, method, node, scope, state, context)
        ) {
          return createReplayLeaf(node, scope, state);
        }
        if (!READONLY_ARRAY_TRANSFORMS.has(method)) {
          markReplayContainerEscaped(value);
        }
        return undefined;
      }
    }

    for (const argument of node.arguments) {
      if (
        argument.type === 'ArgumentPlaceholder' ||
        argument.type === 'SpreadElement'
      ) {
        continue;
      }
      const value = evaluateReplayExpression(argument, scope, state, context);
      if (value?.type === 'container') markReplayContainerEscaped(value);
      if (value?.type === 'ref') markReplayRefEscaped(value);
      if (value?.type === 'collection') markReplayCollectionEscaped(value);
    }
    return undefined;
  }

  /** Produces a stable key for the finite Map/Set values the replay supports. */
  function replayCollectionKey(
    value: ReplayValue,
    state: ScriptState
  ): string | undefined {
    if (value.type === 'leaf') {
      if (value.knownValue) return knownValueKey(value.knownValue);
      const primitive = readStaticFromScope(
        value.expression.node,
        value.expression.scope,
        new Set(),
        value.expression.node.end ?? Number.POSITIVE_INFINITY,
        state.analysis
      );
      return primitive.ok
        ? `${typeof primitive.value}:${String(primitive.value)}`
        : undefined;
    }
    if (
      value.type !== 'container' &&
      value.type !== 'ref' &&
      value.type !== 'collection'
    ) {
      return undefined;
    }
    const identity = value.identity;
    const existing = state.replayIdentityKeys.get(identity);
    if (existing) return existing;
    const key = `identity:${state.nextReplayIdentityKey++}`;
    state.replayIdentityKeys.set(identity, key);
    return key;
  }

  /** Names a collection key when the template can reference the same binding. */
  function replayCollectionTemplateKey(
    value: ReplayValue,
    context: ReplayEvaluationContext,
    state: ScriptState
  ): string | undefined {
    if (value.type === 'leaf') {
      const primitive = readStaticFromScope(
        value.expression.node,
        value.expression.scope,
        new Set(),
        value.expression.node.end ?? Number.POSITIVE_INFINITY,
        state.analysis
      );
      if (
        primitive.ok &&
        (typeof primitive.value === 'string' ||
          typeof primitive.value === 'number')
      ) {
        return String(primitive.value);
      }
      return readResolvedMemberPath(
        value.expression.node,
        value.expression.scope,
        state
      );
    }
    if (!('identity' in value)) return undefined;
    for (const [binding, candidate] of context.values) {
      if (
        candidate &&
        candidate.type === value.type &&
        'identity' in candidate &&
        candidate.identity === value.identity
      ) {
        return binding.identifier.name;
      }
    }
    return undefined;
  }

  /** Evaluates finite Map, Set, and transparent Proxy constructors. */
  function evaluateReplayNewExpression(
    node: t.NewExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const callee = unwrapExpression(node.callee);
    if (callee?.type !== 'Identifier') {
      return undefined;
    }
    const localBinding = scope.getBinding(callee.name);
    if (localBinding) {
      const declaration = localBinding.path.node;
      const classNode =
        declaration.type === 'ClassDeclaration' ||
        declaration.type === 'ClassExpression'
          ? declaration
          : declaration.type === 'VariableDeclarator' &&
              declaration.init?.type === 'ClassExpression'
            ? declaration.init
            : undefined;
      if (!classNode || classNode.superClass || classNode.decorators?.length) {
        return undefined;
      }
      const prototypeEntries = new Map<string, ReplayValue>();
      const prototypeSetters = new Map<string, ReplayMethodReference>();
      const instanceEntries = new Map<string, ReplayValue>();
      const instance = createReplayContainer({
        kind: 'object',
        entries: instanceEntries,
        prototype: createReplayContainer({
          kind: 'object',
          entries: prototypeEntries,
          setters: prototypeSetters,
        }),
      });
      const instanceContext: ReplayEvaluationContext = {
        ...context,
        thisValue: instance,
      };
      let constructor: (ScopedExpression & { node: t.ClassMethod }) | undefined;
      for (const member of classNode.body.body) {
        if ('decorators' in member && member.decorators?.length)
          return undefined;
        if (member.type === 'ClassProperty' && !member.static) {
          if (!member.value) continue;
          const key = readResolvedPropertyKey(member, scope, state);
          if (key === undefined) return undefined;
          const value = evaluateReplayExpression(
            member.value,
            state.scopes.get(member.value) ?? scope,
            state,
            instanceContext
          );
          if (!value) return undefined;
          instanceEntries.set(key, value);
          continue;
        }
        if (member.type !== 'ClassMethod' || member.static) continue;
        if (member.kind === 'constructor') {
          constructor = {
            node: member,
            scope: state.scopes.get(member) ?? scope,
          };
          continue;
        }
        const key = readResolvedPropertyKey(member, scope, state);
        if (key === undefined) return undefined;
        if (member.kind === 'get') {
          prototypeEntries.set(key, {
            type: 'getter',
            getter: {
              node: member,
              scope: state.scopes.get(member) ?? scope,
            },
            substitutions: new Map(context.substitutions),
          });
        } else if (member.kind === 'method') {
          prototypeEntries.set(key, {
            type: 'method',
            callable: {
              node: member,
              scope: state.scopes.get(member) ?? scope,
            },
            substitutions: new Map(context.substitutions),
          });
        } else if (member.kind === 'set') {
          prototypeSetters.set(key, {
            type: 'method',
            callable: {
              node: member,
              scope: state.scopes.get(member) ?? scope,
            },
            substitutions: new Map(context.substitutions),
          });
        }
      }
      if (!constructor) return instance;
      const arguments_: ReplayValue[] = [];
      for (const argument of node.arguments) {
        if (
          argument.type === 'ArgumentPlaceholder' ||
          argument.type === 'SpreadElement'
        ) {
          return undefined;
        }
        const value = evaluateReplayExpression(argument, scope, state, context);
        if (!value) return undefined;
        arguments_.push(value);
      }
      const result = executeReplayFunction(
        constructor,
        arguments_,
        state,
        instanceContext,
        instance
      );
      if (!result.executed) {
        markReplayContainerEscaped(instance);
        return undefined;
      }
      return result.value?.type === 'container' ? result.value : instance;
    }
    const first = node.arguments[0];
    if (callee.name === 'Map' || callee.name === 'Set') {
      const entries = new Map<string, ReplayValue>();
      const templateKeys = new Map<string, string>();
      if (
        first &&
        first.type !== 'ArgumentPlaceholder' &&
        first.type !== 'SpreadElement'
      ) {
        const source = evaluateReplayExpression(first, scope, state, context);
        if (
          source?.type !== 'container' ||
          source.identity.snapshot.kind !== 'array'
        ) {
          return undefined;
        }
        const copied = copyReplayContainerEntries(source, state, context);
        if (!copied || copied.kind !== 'array') return undefined;
        for (const [index, item] of copied.entries.entries()) {
          if (!item) continue;
          if (callee.name === 'Set') {
            const key = replayCollectionKey(item, state) ?? `index:${index}`;
            entries.set(key, item);
            const templateKey = replayCollectionTemplateKey(
              item,
              context,
              state
            );
            if (templateKey !== undefined) templateKeys.set(key, templateKey);
            continue;
          }
          if (
            item.type !== 'container' ||
            item.identity.snapshot.kind !== 'array'
          ) {
            return undefined;
          }
          const keyValue = readReplayContainerEntry(item, '0', state, context);
          const mapValue = readReplayContainerEntry(item, '1', state, context);
          if (!keyValue || !mapValue) return undefined;
          const key = replayCollectionKey(keyValue, state);
          if (key === undefined) return undefined;
          entries.set(key, mapValue);
          const templateKey = replayCollectionTemplateKey(
            keyValue,
            context,
            state
          );
          if (templateKey !== undefined) templateKeys.set(key, templateKey);
        }
      }
      return {
        type: 'collection',
        identity: {
          entries,
          escaped: false,
          kind: callee.name === 'Map' ? 'map' : 'set',
          templateKeys,
        },
        iteration: callee.name === 'Map' ? 'entries' : 'values',
        writePolicy: 'forward',
      };
    }
    if (
      callee.name !== 'Proxy' ||
      !first ||
      first.type === 'ArgumentPlaceholder' ||
      first.type === 'SpreadElement'
    ) {
      return undefined;
    }
    const target = evaluateReplayExpression(first, scope, state, context);
    const handlerNode = node.arguments[1];
    if (
      !handlerNode ||
      handlerNode.type === 'ArgumentPlaceholder' ||
      handlerNode.type === 'SpreadElement'
    ) {
      return undefined;
    }
    const handler = unwrapExpression(handlerNode);
    if (handler?.type !== 'ObjectExpression') return undefined;
    if (handler.properties.length === 0) return target;
    const getProperty = handler.properties.find(
      (property) =>
        property.type === 'ObjectMethod' &&
        readResolvedPropertyKey(property, scope, state) === 'get'
    );
    if (getProperty?.type !== 'ObjectMethod') return undefined;
    const returns = collectFunctionReturnExpressions(getProperty, scope, state);
    if (returns.length !== 1) return undefined;
    const returned = evaluateReplayExpression(
      returns[0]!.node,
      returns[0]!.scope,
      state,
      context
    );
    return returned
      ? createReplayContainer({
          kind: 'object',
          entries: new Map([[unknownTemplatePathSegment, returned]]),
        })
      : undefined;
  }

  /** Evaluates the container identity or captured leaf produced by an expression. */
  function evaluateReplayExpression(
    node: t.Node,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): ReplayValue | undefined {
    const expression = unwrapExpression(node);
    if (!expression) return undefined;
    if (expression.type === 'ThisExpression') {
      return context.thisValue;
    }
    if (expression.type === 'Identifier') {
      const binding = scope.getBinding(expression.name);
      if (binding) {
        const substituted = context.substitutions.get(binding);
        if (substituted) return substituted;
        if (context.values.has(binding)) return context.values.get(binding);
      }
      return createReplayLeaf(expression, scope, state);
    }
    if (
      expression.type === 'ArrowFunctionExpression' ||
      expression.type === 'FunctionExpression'
    ) {
      return {
        type: 'function',
        boundArguments: [],
        callable: {
          node: expression,
          scope: state.scopes.get(expression) ?? scope,
        },
        substitutions: new Map(context.substitutions),
      };
    }
    if (expression.type === 'ArrayExpression') {
      return evaluateReplayArray(expression, scope, state, context);
    }
    if (expression.type === 'ObjectExpression') {
      return evaluateReplayObject(expression, scope, state, context);
    }
    if (expression.type === 'NewExpression') {
      return evaluateReplayNewExpression(expression, scope, state, context);
    }
    if (
      expression.type === 'MemberExpression' ||
      expression.type === 'OptionalMemberExpression'
    ) {
      return (
        evaluateReplayMember(expression, scope, state, context) ??
        createReplayLeaf(expression, scope, state)
      );
    }
    if (
      expression.type === 'CallExpression' ||
      expression.type === 'OptionalCallExpression'
    ) {
      return evaluateReplayCall(expression, scope, state, context);
    }
    if (expression.type === 'SequenceExpression') {
      const last = expression.expressions.at(-1);
      return last
        ? evaluateReplayExpression(last, scope, state, context)
        : undefined;
    }
    if (expression.type === 'AssignmentExpression') {
      return evaluateReplayExpression(expression.right, scope, state, context);
    }
    return createReplayLeaf(expression, scope, state);
  }

  /** Splits a static member target into its base expression and property path. */
  function readReplayMemberTarget(
    node: t.MemberExpression | t.OptionalMemberExpression,
    scope: Scope,
    state: ScriptState
  ): { base: t.Expression | t.Super; properties: string[] } | undefined {
    const properties: string[] = [];
    let current: t.Expression | t.Super = node;
    while (
      current.type === 'MemberExpression' ||
      current.type === 'OptionalMemberExpression'
    ) {
      const property = readResolvedMemberProperty(current, scope, state);
      if (property === undefined) return undefined;
      properties.unshift(property);
      current = current.object;
    }
    return { base: current, properties };
  }

  /** Finds the accessor setter JavaScript would invoke for one property write. */
  function readReplayContainerSetter(
    value: ReplayContainerReference,
    property: string,
    receiver: ReplayContainerReference = value,
    seen: Set<ReplayContainerIdentity> = new Set()
  ): ReplayMethodReference | null | undefined {
    if (
      value.identity.escaped ||
      value.identity.snapshot.kind !== 'object' ||
      seen.has(value.identity)
    ) {
      return undefined;
    }
    const snapshot = value.identity.snapshot;
    const setter = snapshot.setters?.get(property);
    if (setter) return { ...setter, receiver };
    if (snapshot.entries.has(property)) {
      return snapshot.entries.get(property)?.type === 'getter'
        ? undefined
        : null;
    }
    return snapshot.prototype
      ? readReplayContainerSetter(
          snapshot.prototype,
          property,
          receiver,
          new Set(seen).add(value.identity)
        )
      : null;
  }

  /** Applies one direct or nested member assignment to a replayed identity. */
  function applyReplayMemberAssignment(
    left: t.MemberExpression | t.OptionalMemberExpression,
    right: t.Expression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): boolean {
    const target = readReplayMemberTarget(left, scope, state);
    if (!target || target.properties.length === 0) return false;
    let value = evaluateReplayExpression(target.base, scope, state, context);
    for (const property of target.properties.slice(0, -1)) {
      const child =
        value?.type === 'container'
          ? readReplayContainerEntry(value, property, state, context)
          : value?.type === 'ref' && property === 'value'
            ? readReplayRefValue(value)
            : value?.type === 'computed' && property === 'value'
              ? evaluateReplayComputed(value, state, context)
              : undefined;
      if (!child) {
        if (value?.type === 'container') markReplayContainerEscaped(value);
        if (value?.type === 'ref') markReplayRefEscaped(value);
        return false;
      }
      value = child;
    }
    const property = target.properties.at(-1)!;
    if (value?.type === 'ref') {
      if (property !== 'value') {
        markReplayRefEscaped(value);
        return false;
      }
      if (value.writePolicy !== 'forward') return true;
      value.identity.value = evaluateReplayExpression(
        right,
        scope,
        state,
        context
      );
      return value.identity.value !== undefined;
    }
    if (value?.type !== 'container') return false;
    if (value.writePolicy !== 'forward') return true;
    const snapshot = value.identity.snapshot;
    if (snapshot.kind === 'array' && property === 'length') {
      const length = readStaticFromScope(
        right,
        scope,
        new Set(),
        right.end ?? Number.POSITIVE_INFINITY,
        state.analysis,
        true
      );
      if (
        !length.ok ||
        typeof length.value !== 'number' ||
        !Number.isInteger(length.value) ||
        length.value < 0
      ) {
        markReplayContainerEscaped(value);
        return false;
      }
      snapshot.entries.length = length.value;
      return true;
    }
    const replacement = evaluateReplayExpression(right, scope, state, context);
    if (!replacement) {
      markReplayContainerEscaped(value);
      return false;
    }
    if (snapshot.kind === 'object') {
      const setter = readReplayContainerSetter(value, property);
      if (setter === undefined) {
        markReplayContainerEscaped(value);
        return false;
      }
      if (setter) {
        const result = executeReplayFunction(
          setter.callable,
          [replacement],
          state,
          { ...context, substitutions: new Map(setter.substitutions) },
          setter.receiver
        );
        if (!result.executed) {
          markReplayContainerEscaped(value);
          return false;
        }
        return true;
      }
    }
    if (snapshot.kind === 'array') {
      if (!/^(0|[1-9]\d*)$/.test(property)) {
        markReplayContainerEscaped(value);
        return false;
      }
      snapshot.entries[Number(property)] = replacement;
    } else {
      snapshot.entries.set(property, replacement);
    }
    return true;
  }

  /** Applies JavaScript delete semantics to one replayed own property. */
  function applyReplayMemberDelete(
    argument: t.MemberExpression | t.OptionalMemberExpression,
    scope: Scope,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): boolean {
    const target = readReplayMemberTarget(argument, scope, state);
    if (!target || target.properties.length === 0) return false;
    let value = evaluateReplayExpression(target.base, scope, state, context);
    for (const property of target.properties.slice(0, -1)) {
      value =
        value?.type === 'container'
          ? readReplayContainerEntry(value, property, state, context)
          : value?.type === 'ref' && property === 'value'
            ? readReplayRefValue(value)
            : value?.type === 'computed' && property === 'value'
              ? evaluateReplayComputed(value, state, context)
              : undefined;
      if (!value) return false;
    }
    if (value?.type !== 'container') return false;
    if (value.writePolicy !== 'forward') return true;
    const property = target.properties.at(-1)!;
    const snapshot = value.identity.snapshot;
    if (snapshot.kind === 'array') {
      if (!/^(0|[1-9]\d*)$/.test(property)) return false;
      snapshot.entries[Number(property)] = undefined;
    } else {
      snapshot.entries.delete(property);
    }
    return true;
  }

  /** Invalidates one replay binding and every identity reachable through it. */
  function invalidateReplayBinding(
    binding: Binding | undefined,
    context: ReplayEvaluationContext
  ): void {
    if (!binding || !context.values.has(binding)) return;
    const value = context.values.get(binding);
    if (value?.type === 'container') markReplayContainerEscaped(value);
    if (value?.type === 'ref') markReplayRefEscaped(value);
    if (value?.type === 'collection') markReplayCollectionEscaped(value);
    context.unsafeBindings.add(binding);
    context.values.set(binding, undefined);
  }

  /** Invalidates identities captured by a local callback we cannot execute. */
  function invalidateReplayFunctionCaptures(
    fn: t.Function,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): void {
    const path = state.paths.get(fn);
    if (!path) return;
    path.traverse({
      Identifier(identifierPath) {
        invalidateReplayBinding(
          identifierPath.scope.getBinding(identifierPath.node.name),
          context
        );
      },
    });
  }

  /** Invalidates only identities referenced by unsupported control flow. */
  function invalidateReplayStatement(
    path: NodePath<t.Node>,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): void {
    if (path.isIdentifier()) {
      invalidateReplayBinding(path.scope.getBinding(path.node.name), context);
    }
    path.traverse({
      CallExpression(callPath) {
        const callable = resolveCalledFunction(
          callPath.node.callee,
          callPath.scope,
          state,
          new Set()
        );
        if (callable) {
          invalidateReplayFunctionCaptures(callable.node, state, context);
        }
        for (const argument of callPath.node.arguments) {
          if (
            argument.type === 'ArgumentPlaceholder' ||
            argument.type === 'SpreadElement'
          ) {
            continue;
          }
          markReplayValueEscaped(
            evaluateReplayExpression(argument, callPath.scope, state, context)
          );
        }
      },
      OptionalCallExpression(callPath) {
        const callable = resolveCalledFunction(
          callPath.node.callee,
          callPath.scope,
          state,
          new Set()
        );
        if (callable) {
          invalidateReplayFunctionCaptures(callable.node, state, context);
        }
        for (const argument of callPath.node.arguments) {
          if (
            argument.type === 'ArgumentPlaceholder' ||
            argument.type === 'SpreadElement'
          ) {
            continue;
          }
          markReplayValueEscaped(
            evaluateReplayExpression(argument, callPath.scope, state, context)
          );
        }
      },
      Identifier(identifierPath) {
        invalidateReplayBinding(
          identifierPath.scope.getBinding(identifierPath.node.name),
          context
        );
      },
    });
  }

  /** Executes one direct sibling statement in the finite identity subset. */
  function replayContainerStatement(
    path: NodePath<t.Node>,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): void {
    if (path.isImportDeclaration() || path.isFunctionDeclaration()) return;
    if (path.isVariableDeclaration()) {
      for (const declarator of path.get('declarations')) {
        if (!declarator.isVariableDeclarator()) continue;
        if (declarator.node.id.type !== 'Identifier') {
          const source = declarator.node.init
            ? evaluateReplayExpression(
                declarator.node.init,
                declarator.scope,
                state,
                context
              )
            : undefined;
          const unsafe =
            source?.type === 'unsafe' ||
            (source?.type === 'container' && source.identity.escaped) ||
            (source?.type === 'collection' && source.identity.escaped) ||
            (source?.type === 'ref' && source.identity.escaped);
          if (unsafe) {
            for (const name of collectPatternBindingNames(declarator.node.id)) {
              const binding = declarator.scope.getBinding(name);
              if (!binding) continue;
              context.unsafeBindings.add(binding);
              context.values.set(binding, replayUnsafe);
            }
            continue;
          }
          invalidateReplayStatement(declarator, state, context);
          continue;
        }
        const binding = declarator.scope.getBinding(declarator.node.id.name);
        if (!binding) continue;
        const value = declarator.node.init
          ? evaluateReplayExpression(
              declarator.node.init,
              declarator.scope,
              state,
              context
            )
          : undefined;
        if (value?.type === 'unsafe') context.unsafeBindings.add(binding);
        else context.unsafeBindings.delete(binding);
        context.values.set(binding, value);
      }
      return;
    }
    if (!path.isExpressionStatement()) {
      invalidateReplayStatement(path, state, context);
      return;
    }
    const expression = unwrapExpression(path.node.expression);
    if (
      expression?.type === 'UnaryExpression' &&
      expression.operator === 'delete' &&
      (expression.argument.type === 'MemberExpression' ||
        expression.argument.type === 'OptionalMemberExpression')
    ) {
      if (
        !applyReplayMemberDelete(
          expression.argument,
          path.scope,
          state,
          context
        )
      ) {
        invalidateReplayStatement(path, state, context);
      }
      return;
    }
    if (expression?.type === 'AssignmentExpression') {
      if (expression.operator !== '=') {
        invalidateReplayStatement(path, state, context);
        return;
      }
      if (expression.left.type === 'Identifier') {
        const binding = path.scope.getBinding(expression.left.name);
        if (!binding) return;
        const value = evaluateReplayExpression(
          expression.right,
          path.scope,
          state,
          context
        );
        if (value?.type === 'unsafe') context.unsafeBindings.add(binding);
        else context.unsafeBindings.delete(binding);
        context.values.set(binding, value);
        return;
      }
      if (
        expression.left.type === 'MemberExpression' ||
        expression.left.type === 'OptionalMemberExpression'
      ) {
        if (
          !applyReplayMemberAssignment(
            expression.left,
            expression.right,
            path.scope,
            state,
            context
          )
        ) {
          invalidateReplayStatement(path, state, context);
        }
        return;
      }
      invalidateReplayStatement(path, state, context);
      return;
    }
    if (
      expression?.type === 'CallExpression' ||
      expression?.type === 'OptionalCallExpression'
    ) {
      evaluateReplayCall(expression, path.scope, state, context);
      return;
    }
    invalidateReplayStatement(path, state, context);
  }

  /** Replays one lexical statement list once and caches it for every binding. */
  function readContainerIdentityReplay(
    binding: Binding,
    state: ScriptState
  ): ContainerIdentityReplay | undefined {
    const statement = binding.path.getStatementParent();
    const bodyPath = statement?.parentPath;
    if (
      !statement ||
      !bodyPath ||
      (!bodyPath.isProgram() && !bodyPath.isBlockStatement())
    ) {
      return undefined;
    }
    const cached = state.containerIdentityReplays.get(bodyPath.node);
    if (cached) return cached;
    const context: ReplayEvaluationContext = {
      allowGetterEffects: true,
      substitutions: new Map(),
      unsafeBindings: new Set(),
      values: new Map(),
    };
    const body = bodyPath.get('body');
    if (!Array.isArray(body)) return undefined;
    for (const child of body) {
      replayContainerStatement(child as NodePath<t.Node>, state, context);
    }
    const replay = {
      unsafeBindings: context.unsafeBindings,
      values: context.values,
    };
    state.containerIdentityReplays.set(bodyPath.node, replay);
    return replay;
  }

  function createReplayContextAtPosition(
    node: t.Node,
    atPosition: number,
    state: ScriptState
  ): ReplayEvaluationContext | undefined {
    const expression = unwrapExpression(node) ?? node;
    const nodePath = state.paths.get(expression) ?? state.paths.get(node);
    const statement = nodePath?.getStatementParent();
    const bodyPath = statement?.parentPath;
    if (
      !statement ||
      !bodyPath ||
      (!bodyPath.isProgram() && !bodyPath.isBlockStatement())
    ) {
      return undefined;
    }
    const body = bodyPath.get('body');
    if (!Array.isArray(body)) return undefined;
    const context: ReplayEvaluationContext = {
      allowGetterEffects: true,
      substitutions: new Map(),
      unsafeBindings: new Set(),
      values: new Map(),
    };
    for (const child of body) {
      if (
        child.node === statement.node ||
        (child.node.start ?? Number.POSITIVE_INFINITY) >= atPosition
      ) {
        break;
      }
      replayContainerStatement(child as NodePath<t.Node>, state, context);
    }
    return context;
  }

  function evaluateReplayAtPosition(
    node: t.Node,
    scope: Scope,
    atPosition: number,
    state: ScriptState
  ): ReplayValue | undefined {
    const expression = unwrapExpression(node) ?? node;
    const context = createReplayContextAtPosition(
      expression,
      atPosition,
      state
    );
    return context
      ? evaluateReplayExpression(expression, scope, state, context)
      : undefined;
  }
  function replayMaySelectStringRoleAtPosition(
    node: t.Node,
    scope: Scope,
    atPosition: number,
    role: 'factory' | 'translator',
    state: ScriptState
  ): boolean {
    const expression = unwrapExpression(node) ?? node;
    const context = createReplayContextAtPosition(
      expression,
      atPosition,
      state
    );
    if (!context) return false;
    const visibleEntries = (value: ReplayValue): ReplayValue[] => {
      if (value.type !== 'container') return [];
      const entries = readReplayVisibleContainerEntries(value, state, context);
      return entries
        ? entries.flatMap(([, entry]) => (entry ? [entry] : []))
        : [];
    };
    const possibleValues = (
      candidate: t.Node,
      candidateScope: Scope,
      seen: Set<t.Node>
    ): ReplayValue[] => {
      const expression = unwrapExpression(candidate);
      if (!expression || seen.has(expression)) return [];
      const nextSeen = new Set(seen).add(expression);
      if (expression.type === 'ConditionalExpression') {
        const condition = readStaticFromScope(
          expression.test,
          candidateScope,
          new Set(),
          expression.test.end ?? Number.POSITIVE_INFINITY,
          state.analysis
        );
        const branches = condition.ok
          ? [condition.value ? expression.consequent : expression.alternate]
          : [expression.consequent, expression.alternate];
        return branches.flatMap((branch) =>
          possibleValues(branch, candidateScope, nextSeen)
        );
      }
      if (expression.type === 'LogicalExpression') {
        let selection = readStaticLogicalSelection(
          expression,
          candidateScope,
          state
        );
        const leftValue = selection
          ? undefined
          : evaluateReplayExpression(
              expression.left,
              candidateScope,
              state,
              context
            );
        const replayTruthy = Boolean(
          leftValue &&
          leftValue.type !== 'unsafe' &&
          (leftValue.type !== 'leaf' || leftValue.stringRole)
        );
        if (replayTruthy) {
          selection = expression.operator === '&&' ? 'right' : 'left';
        }
        if (!selection) {
          return [expression.left, expression.right].flatMap((branch) =>
            possibleValues(branch, candidateScope, nextSeen)
          );
        }
        return possibleValues(expression[selection], candidateScope, nextSeen);
      }
      if (
        (expression.type === 'MemberExpression' ||
          expression.type === 'OptionalMemberExpression') &&
        readResolvedMemberProperty(expression, candidateScope, state) ===
          undefined
      ) {
        return possibleValues(
          expression.object,
          candidateScope,
          nextSeen
        ).flatMap(visibleEntries);
      }
      const value = evaluateReplayExpression(
        expression,
        candidateScope,
        state,
        context
      );
      return value ? [value] : [];
    };
    const hasRole = (
      value: ReplayValue,
      expected: 'factory' | 'translator',
      seen: Set<ReplayValue>
    ): boolean => {
      if (seen.has(value)) return false;
      if (value.type === 'leaf') {
        if (value.stringRole === expected) return true;
        const expression = unwrapExpression(value.expression.node);
        const binding =
          expression?.type === 'Identifier'
            ? value.expression.scope.getBinding(expression.name)
            : undefined;
        const substitution = binding
          ? readParameterSubstitution(binding, state)
          : undefined;
        if (!substitution) return false;
        const nextSeen = new Set(seen).add(value);
        return possibleValues(
          substitution.node,
          substitution.scope,
          new Set()
        ).some((candidate) => hasRole(candidate, expected, nextSeen));
      }
      if (
        expected !== 'factory' ||
        (value.type !== 'function' && value.type !== 'method')
      ) {
        return false;
      }
      const result = executeReplayFunction(
        value.callable,
        value.type === 'function' ? value.boundArguments : [],
        state,
        {
          ...context,
          substitutions: new Map(value.substitutions),
        },
        value.type === 'function' ? value.thisValue : value.receiver
      );
      return Boolean(
        result?.executed &&
        result.value &&
        hasRole(result.value, 'translator', new Set(seen).add(value))
      );
    };
    const matches = (
      candidate: t.Node,
      expected: 'factory' | 'translator'
    ): boolean =>
      possibleValues(candidate, scope, new Set()).some((value) =>
        hasRole(value, expected, new Set())
      );
    if (matches(expression, role)) return true;
    return Boolean(
      role === 'translator' &&
      (expression?.type === 'CallExpression' ||
        expression?.type === 'OptionalCallExpression') &&
      matches(expression.callee, 'factory')
    );
  }
  /** Applies Vue template top-level ref/computed unwrapping to replayed bindings. */
  function readReplayTemplateValue(
    value: ReplayValue | undefined,
    state: ScriptState,
    replay: ContainerIdentityReplay
  ): ReplayValue | undefined {
    const context: ReplayEvaluationContext = {
      substitutions: new Map(),
      unsafeBindings: replay.unsafeBindings,
      values: replay.values,
    };
    const seen = new Set<ReplayValue>();
    let current = value;
    while (
      current &&
      !seen.has(current) &&
      (current.type === 'ref' || current.type === 'computed')
    ) {
      seen.add(current);
      current =
        current.type === 'ref'
          ? readReplayRefValue(current)
          : evaluateReplayComputed(current, state, context);
    }
    return current;
  }

  /** Reads a final scalar component identity without reviving stale sources. */
  function readReplayLeafState(
    binding: Binding,
    state: ScriptState
  ): ReplayLeafState | undefined {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay || !replay.values.has(binding)) return undefined;
    const value = readReplayTemplateValue(
      replay.values.get(binding),
      state,
      replay
    );
    if (value?.type === 'unsafe') return { status: 'unsafe' };
    return value?.type === 'leaf' &&
      value.exactSelection &&
      value.hasGT !== undefined
      ? { status: 'leaf', value }
      : undefined;
  }

  /** Keeps exact replay from bypassing deliberate opaque-resolution boundaries. */
  function readSafeReplayLeafOverride(
    binding: Binding,
    replayLeaf: ReplayLeafState | undefined,
    state: ScriptState
  ): Extract<ReplayLeafState, { status: 'leaf' }> | undefined {
    if (replayLeaf?.status !== 'leaf') return undefined;
    const { value } = replayLeaf;
    if (bindingReadsUnsafeMutableImport(binding, state)) return undefined;
    if (value.knownValue?.type === 'vue-builtin') return undefined;
    if (
      value.selectionKind === 'ref' &&
      value.knownValue?.type === 'component'
    ) {
      return undefined;
    }
    return isReplayGetterStringLeaf(value) ? undefined : replayLeaf;
  }

  /** String translators selected through a getter remain intentionally opaque. */
  function isReplayGetterStringLeaf(value: ReplayLeaf): boolean {
    return (
      value.selectionKind === 'getter' && value.knownValue?.type === 'string'
    );
  }

  /** Detects unresolved mutable identities retained by one final replay value. */
  function replayBindingRetainsUnsafeIdentity(
    binding: Binding,
    state: ScriptState
  ): boolean {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay || replay.unsafeBindings.has(binding)) return Boolean(replay);
    const seen = new Set<object>();
    const visit = (value: ReplayValue | undefined): boolean => {
      if (!value) return false;
      if (value.type === 'unsafe') return true;
      if (value.type === 'container') {
        if (value.identity.escaped || seen.has(value.identity)) {
          return value.identity.escaped;
        }
        seen.add(value.identity);
        const snapshot = value.identity.snapshot;
        const entries =
          snapshot.kind === 'array'
            ? snapshot.entries
            : snapshot.entries.values();
        for (const entry of entries) {
          if (visit(entry)) return true;
        }
        return snapshot.kind === 'object' && snapshot.prototype
          ? visit(snapshot.prototype)
          : false;
      }
      if (value.type === 'ref') {
        if (value.identity.escaped || seen.has(value.identity)) {
          return value.identity.escaped;
        }
        seen.add(value.identity);
        return visit(value.identity.value);
      }
      if (value.type === 'collection') {
        if (value.identity.escaped || seen.has(value.identity)) {
          return value.identity.escaped;
        }
        seen.add(value.identity);
        return [...value.identity.entries.values()].some(visit);
      }
      if (value.type === 'function') {
        return (
          value.boundArguments.some(visit) ||
          [...value.substitutions.values()].some(visit)
        );
      }
      if (value.type === 'getter' || value.type === 'method') {
        return [...value.substitutions.values()].some(visit);
      }
      return false;
    };
    return visit(replay.values.get(binding));
  }

  /** Collects exact tainted-container paths from one final runtime identity. */
  function replayContainerIdentityHasGT(
    value: ReplayContainerReference,
    seen: Set<ReplayContainerIdentity>,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): boolean | undefined {
    if (value.identity.escaped) return undefined;
    if (seen.has(value.identity)) return false;
    const nextSeen = new Set(seen).add(value.identity);
    const visible = readReplayVisibleContainerEntries(value, state, context);
    if (!visible) return undefined;
    let unknown = false;
    for (const [, entry] of visible) {
      if (!entry) continue;
      if (entry.type === 'leaf') {
        if (entry.hasGT) return true;
        if (entry.hasGT === undefined) unknown = true;
        continue;
      }
      if (entry.type !== 'container') {
        unknown = true;
        continue;
      }
      const nested = replayContainerIdentityHasGT(
        entry,
        nextSeen,
        state,
        context
      );
      if (nested) return true;
      if (nested === undefined) unknown = true;
    }
    return unknown ? undefined : false;
  }

  /** Collects exact tainted-container paths from one final runtime identity. */
  function collectReplayGTContainerPaths(
    value: ReplayContainerReference,
    basePath: string,
    seen: Set<ReplayContainerIdentity>,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): Set<string> | undefined {
    if (value.identity.escaped) return new Set([basePath]);
    if (seen.has(value.identity)) {
      const hasGT = replayContainerIdentityHasGT(
        value,
        new Set(),
        state,
        context
      );
      return hasGT === undefined
        ? undefined
        : hasGT
          ? new Set([
              appendTemplatePath(basePath, recursiveTemplatePathSegment),
            ])
          : new Set();
    }
    const nextSeen = new Set(seen).add(value.identity);
    const result = new Set<string>();
    const entries = readReplayVisibleContainerEntries(value, state, context);
    if (!entries) return undefined;
    for (const [key, entry] of entries) {
      if (!entry) continue;
      if (entry.type === 'leaf') {
        if (entry.hasGT === undefined) return undefined;
        if (entry.hasGT) result.add(basePath);
        continue;
      }
      if (entry.type !== 'container') return undefined;
      const nested = collectReplayGTContainerPaths(
        entry,
        appendTemplatePath(basePath, key),
        nextSeen,
        state,
        context
      );
      if (!nested) return undefined;
      for (const path of nested) result.add(path);
    }
    return result;
  }

  /** Conservatively taints a finite Map/Set when any selected value can be T. */
  function collectReplayCollectionGTContainerPaths(
    value: ReplayCollectionReference,
    basePath: string,
    state: ScriptState,
    context: ReplayEvaluationContext
  ): Set<string> | undefined {
    if (value.identity.escaped) return new Set([basePath]);
    let nestedGT = false;
    for (const entry of value.identity.entries.values()) {
      if (entry.type === 'leaf') {
        if (entry.hasGT === undefined) return undefined;
        continue;
      }
      if (entry.type === 'container') {
        const nested = collectReplayGTContainerPaths(
          entry,
          basePath,
          new Set(),
          state,
          context
        );
        if (!nested) return undefined;
        nestedGT ||= nested.size > 0;
        continue;
      }
      return undefined;
    }
    return nestedGT ? new Set([basePath]) : new Set();
  }

  /** Reads exact final T-container paths when identity replay stayed finite. */
  function readDefiniteReplayGTContainerPaths(
    binding: Binding,
    state: ScriptState
  ): Set<string> | null | undefined {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay || !replay.values.has(binding)) return undefined;
    const context: ReplayEvaluationContext = {
      substitutions: new Map(),
      unsafeBindings: replay.unsafeBindings,
      values: replay.values,
    };
    const value = replay
      ? readReplayTemplateValue(replay.values.get(binding), state, replay)
      : undefined;
    if (value?.type === 'container') {
      return (
        collectReplayGTContainerPaths(
          value,
          binding.identifier.name,
          new Set(),
          state,
          context
        ) ?? null
      );
    }
    if (value?.type === 'collection') {
      return (
        collectReplayCollectionGTContainerPaths(
          value,
          binding.identifier.name,
          state,
          context
        ) ?? null
      );
    }
    if (value?.type === 'unsafe') return null;
    return value === undefined && replay.unsafeBindings.has(binding)
      ? null
      : undefined;
  }

  /** Reads exact final array/object shape from the same identity replay. */
  function readReplayContainerMetadata(
    binding: Binding,
    basePath: string,
    state: ScriptState
  ):
    | {
        arrayLengths: Map<string, number>;
        kinds: Map<string, TemplateContainerKind>;
      }
    | undefined {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay) return undefined;
    const context: ReplayEvaluationContext = {
      substitutions: new Map(),
      unsafeBindings: replay.unsafeBindings,
      values: replay.values,
    };
    const root = replay
      ? readReplayTemplateValue(replay.values.get(binding), state, replay)
      : undefined;
    if (root?.type === 'collection') {
      return root.identity.escaped
        ? undefined
        : {
            arrayLengths: new Map(),
            kinds: new Map([[basePath, 'object']]),
          };
    }
    if (root?.type !== 'container') return undefined;
    const arrayLengths = new Map<string, number>();
    const kinds = new Map<string, TemplateContainerKind>();
    const visit = (
      value: ReplayContainerReference,
      path: string,
      seen: Set<ReplayContainerIdentity>
    ): boolean => {
      if (value.identity.escaped) return false;
      if (seen.has(value.identity)) return true;
      const nextSeen = new Set(seen).add(value.identity);
      const snapshot = value.identity.snapshot;
      kinds.set(path, snapshot.kind);
      if (snapshot.kind === 'array')
        arrayLengths.set(path, snapshot.entries.length);
      const entries = readReplayVisibleContainerEntries(value, state, context);
      if (!entries) return false;
      for (const [key, entry] of entries) {
        if (
          entry?.type === 'container' &&
          !visit(entry, appendTemplatePath(path, key), nextSeen)
        ) {
          return false;
        }
      }
      return true;
    };
    return visit(root, basePath, new Set())
      ? { arrayLengths, kinds }
      : undefined;
  }

  /** Exposes exact component leaves from a replayed final container. */
  function readReplayComponentCandidates(
    binding: Binding,
    basePath: string,
    state: ScriptState
  ): ComponentMemberCandidate[] | undefined {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay) return undefined;
    const context: ReplayEvaluationContext = {
      substitutions: new Map(),
      unsafeBindings: replay.unsafeBindings,
      values: replay.values,
    };
    const root = replay
      ? readReplayTemplateValue(replay.values.get(binding), state, replay)
      : undefined;
    if (root?.type === 'collection') {
      if (root.identity.escaped) return undefined;
      const result: ComponentMemberCandidate[] = [];
      for (const [key, entry] of root.identity.entries) {
        if (entry.type !== 'leaf' || entry.hasGT === undefined)
          return undefined;
        if (!entry.knownValue) continue;
        const name = appendTemplatePath(
          basePath,
          root.identity.templateKeys.get(key) ?? unknownTemplatePathSegment
        );
        result.push({
          certain: !isReplayGetterStringLeaf(entry),
          name,
          value: entry.knownValue,
        });
      }
      return result;
    }
    if (root?.type !== 'container') return undefined;
    const result: ComponentMemberCandidate[] = [];
    const visit = (
      value: ReplayContainerReference,
      path: string,
      seen: Set<ReplayContainerIdentity>
    ): boolean => {
      if (value.identity.escaped) return false;
      if (seen.has(value.identity)) return true;
      const nextSeen = new Set(seen).add(value.identity);
      const entries = readReplayVisibleContainerEntries(value, state, context);
      if (!entries) return false;
      for (const [key, entry] of entries) {
        if (!entry) continue;
        const childPath = appendTemplatePath(path, key);
        if (entry.type === 'container') {
          if (!visit(entry, childPath, nextSeen)) return false;
        } else if (entry.type === 'leaf') {
          if (entry.hasGT === undefined) return false;
          if (entry.knownValue) {
            result.push({
              certain: !isReplayGetterStringLeaf(entry),
              name: childPath,
              value: entry.knownValue,
            });
          }
        } else {
          return false;
        }
      }
      return true;
    };
    return visit(root, basePath, new Set()) ? result : undefined;
  }

  /** Exposes pure receiver methods whose final return is a known component. */
  function readReplayComponentFactoryCandidates(
    binding: Binding,
    basePath: string,
    state: ScriptState
  ): ComponentFactoryCandidate[] | undefined {
    const replay = readContainerIdentityReplay(binding, state);
    if (!replay) return undefined;
    const context: ReplayEvaluationContext = {
      substitutions: new Map(),
      unsafeBindings: replay.unsafeBindings,
      values: replay.values,
    };
    const root = readReplayTemplateValue(
      replay.values.get(binding),
      state,
      replay
    );
    if (root?.type !== 'container') return undefined;
    const result: ComponentFactoryCandidate[] = [];
    const visit = (
      value: ReplayContainerReference,
      path: string,
      seen: Set<ReplayContainerIdentity>
    ): boolean => {
      if (value.identity.escaped) return false;
      if (seen.has(value.identity)) return true;
      const entries = readReplayVisibleContainerEntries(value, state, context);
      if (!entries) return false;
      const nextSeen = new Set(seen).add(value.identity);
      for (const [key, entry] of entries) {
        if (!entry) continue;
        const childPath = appendTemplatePath(path, key);
        if (entry.type === 'container') {
          if (!visit(entry, childPath, nextSeen)) return false;
          continue;
        }
        if (entry.type === 'leaf') {
          if (entry.hasGT === undefined) return false;
          continue;
        }
        if (entry.type !== 'method' || !entry.receiver) return false;
        const body = entry.callable.node.body;
        if (
          body.type === 'BlockStatement' &&
          (body.body.length !== 1 || body.body[0]?.type !== 'ReturnStatement')
        ) {
          return false;
        }
        const returns = collectFunctionReturnExpressions(
          entry.callable.node,
          entry.callable.scope,
          state
        );
        if (returns.length !== 1) return false;
        const returned = evaluateReplayExpression(
          returns[0]!.node,
          returns[0]!.scope,
          state,
          {
            ...context,
            substitutions: new Map(entry.substitutions),
            thisValue: entry.receiver,
          }
        );
        if (returned?.type !== 'leaf' || returned.hasGT === undefined) {
          return false;
        }
        if (
          returned.knownValue?.type === 'component' ||
          returned.knownValue?.type === 'vue-builtin'
        ) {
          result.push({
            gt:
              returned.knownValue.type === 'component' &&
              returned.knownValue.name === 'T',
            name: childPath,
          });
        }
      }
      return true;
    };
    return visit(root, basePath, new Set()) ? result : undefined;
  }

  return {
    evaluateReplayAtPosition,
    isReplayGetterStringLeaf,
    readDefiniteReplayGTContainerPaths,
    readReplayComponentCandidates,
    readReplayComponentFactoryCandidates,
    readReplayContainerMetadata,
    readReplayLeafState,
    readSafeReplayLeafOverride,
    replayBindingRetainsUnsafeIdentity,
    replayMaySelectStringRoleAtPosition,
  };
}
