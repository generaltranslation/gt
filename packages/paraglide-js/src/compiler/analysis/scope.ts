import {
  analyze,
  type Definition,
  type Reference,
  type Scope as ManagedScope,
  type ScopeManager,
  type Variable,
} from '@typescript-eslint/scope-manager';
import {
  isFunction,
  patternBindings,
  staticPropertyName,
  staticString,
  unwrapExpression,
  walk,
  type ESTree,
  type FunctionNode,
  type Node,
  type Pattern,
} from './ast.js';
import {
  argumentOf,
  omitsArgument,
  type CallSite,
  type Candidate,
} from './call-sites.js';
import {
  classNamespace,
  followCandidate,
  followPath,
  resolveBinding,
} from './evaluate.js';
import { importedName } from './module-syntax.js';
import type { TrackedSymbol } from './types.js';
import type { PropsReads } from '../languages/language.js';

/** What a scope needs from the module graph, for the module it belongs to. */
export type ModuleHost = {
  namespace(specifier: string): TrackedSymbol | undefined;
  exportOf(specifier: string, exportName: string): TrackedSymbol | undefined;
  /** In its module and in the modules that import it. */
  callSitesOf?(fn: FunctionNode): CallSite[];
  /** Where the component reads its props, and what each place that renders it passes. */
  props?: { reads: PropsReads; candidates(): Candidate[] };
};

/** What a name may hold. */
export type Binding = (
  | { type: 'shadow' }
  | { type: 'lazy'; get: () => TrackedSymbol | undefined }
  | {
      type: 'alias';
      init: Node;
      path: string[];
      /** A function when the scope is created later. */
      scope: Scope | (() => Scope | undefined);
      map?: (symbol: TrackedSymbol) => TrackedSymbol;
    }
  | {
      type: 'values';
      candidates: () => Candidate[];
      /** The candidates that can reach `read`. */
      at?: (read: Node) => Candidate[];
      /** Holds what call sites pass: a parameter or a prop. */
      parameter?: boolean;
    }
) & {
  /** The node its call sites are indexed under: a function or an import specifier. */
  declaration?: Node;
};

/**
 * Names a module uses without declaring them, e.g. component fields or
 * auto-imports. `at` is the identifier that reads the name, when one does.
 */
export type ImplicitNames = (name: string, at?: Node) => Binding | undefined;

type ExpressionCandidate = Extract<Candidate, { type: 'expression' }>;

/** A value written to a variable. */
type Write = {
  candidate: Candidate;
  node: Node;
  /** Set when the write is a statement of its own, which always runs when its block does. */
  statement?: Node;
};

const SHADOW: Binding = { type: 'shadow' };

const MAX_ALIAS_CHAIN = 8;

const BLOCKS = new Set(['Program', 'BlockStatement', 'StaticBlock']);

const DESTRUCTURING_PARTS = new Set([
  'ObjectPattern',
  'ArrayPattern',
  'Property',
  'AssignmentPattern',
  'RestElement',
]);

// scope-manager is typed for typescript-estree's nodes; it is given oxc's, which have the same shape.
const toNode = (node: object) => node as Node;

/**
 * A module's names. `@typescript-eslint/scope-manager` says which declaration
 * each identifier refers to; this adds what a declaration may hold.
 */
export class Scope {
  private readonly topLevel: ManagedScope;
  private readonly references: Map<Node, Reference>;
  private readonly parents: Map<Node, Node>;
  private readonly bindings = new WeakMap<Variable, Binding>();

  constructor(
    program: ESTree.Program,
    readonly host: ModuleHost,
    private readonly implicitNames: ImplicitNames = () => undefined,
    /** Replace module-level names, e.g. Vue's generated `__VLS_ctx`. */
    private readonly overrides: ReadonlyMap<string, Binding> = new Map()
  ) {
    const manager = analyze(program as never, {
      sourceType: 'module',
      lib: [],
      jsxPragma: null,
    });
    const global = manager.globalScope!;

    this.topLevel =
      global.childScopes.find((scope) => scope.type === 'module') ?? global;
    this.references = referencesByIdentifier(manager);
    this.parents = parentsByNode(program);
  }

  /** What a module-level name holds. */
  lookup(name: string): TrackedSymbol | undefined {
    const binding = this.bindingOf(name);

    return binding && resolveBinding(binding)[0];
  }

  lookupAt(identifier: Node): TrackedSymbol | undefined {
    return this.lookupAllAt(identifier)[0];
  }

  /** Every value an identifier or JSX tag name may hold where it is. */
  lookupAllAt(identifier: Node): TrackedSymbol[] {
    const binding = this.bindingAt(identifier);

    return binding ? resolveBinding(binding, identifier) : [];
  }

  /** `at` is the identifier that reads the name, when one does. */
  bindingOf(moduleLevelName: string, at?: Node): Binding | undefined {
    const override = this.overrides.get(moduleLevelName);
    if (override) return override;

    const variable = this.topLevel.set.get(moduleLevelName);

    return variable
      ? this.bindingOfVariable(variable)
      : this.implicitNames(moduleLevelName, at);
  }

  bindingAt(identifier: Node): Binding | undefined {
    const name = nameOf(identifier);
    const reference = this.references.get(identifier);

    if (!reference)
      return name === undefined ? undefined : this.bindingOf(name, identifier);

    const variable = reference.resolved;
    if (!variable) {
      return name === undefined
        ? undefined
        : this.implicitNames(name, identifier);
    }

    const isModuleLevel = variable.scope === this.topLevel;
    const override = isModuleLevel
      ? this.overrides.get(variable.name)
      : undefined;

    return override ?? this.bindingOfVariable(variable);
  }

  /** False for declarations, keys, labels and plain writes. */
  isRead(identifier: Node): boolean {
    return this.references.get(identifier)?.isRead() ?? false;
  }

  isGlobal(identifier: Node): boolean {
    const reference = this.references.get(identifier);
    if (reference) return reference.resolved === null;

    const name = nameOf(identifier);

    return name !== undefined && !this.topLevel.set.has(name);
  }

  /** The class whose method or field initializer `node` is in. */
  thisAt(node: Node): TrackedSymbol | undefined {
    for (const { parent, child } of this.ancestry(node)) {
      if (parent.type === 'ArrowFunctionExpression') continue;

      if (isFunction(parent)) {
        const owner = this.parents.get(parent);
        return owner?.type === 'MethodDefinition'
          ? this.classOf(owner)
          : undefined;
      }

      const isField =
        parent.type === 'PropertyDefinition' ||
        parent.type === 'AccessorProperty';
      const isFieldInitializer = isField && child === parent.value;

      if (isFieldInitializer || parent.type === 'StaticBlock')
        return this.classOf(parent);
    }

    return undefined;
  }

  private classOf(member: Node): TrackedSymbol | undefined {
    const classBody = this.parents.get(member);
    const classNode = classBody && this.parents.get(classBody);

    const isClass =
      classNode?.type === 'ClassDeclaration' ||
      classNode?.type === 'ClassExpression';

    return isClass ? classNamespace(classNode, this) : undefined;
  }

  private *ancestry(node: Node): Generator<{ parent: Node; child: Node }> {
    let child = node;

    for (
      let parent = this.parents.get(node);
      parent;
      parent = this.parents.get(parent)
    ) {
      yield { parent, child };
      child = parent;
    }
  }

  private enclosingFunction(node: Node): Node | undefined {
    for (const { parent } of this.ancestry(node)) {
      if (isFunction(parent)) return parent;
    }

    return undefined;
  }

  private bindingOfVariable(variable: Variable): Binding {
    let binding = this.bindings.get(variable);

    if (!binding) {
      binding = this.createBinding(variable);
      this.bindings.set(variable, binding);
    }

    return binding;
  }

  private createBinding(variable: Variable): Binding {
    // `type Message = …` and `function Message()` are one variable; the value counts.
    const definition = variable.defs.find(
      (candidate) => candidate.type !== 'Type'
    );
    if (!definition || !variable.isValueVariable) return SHADOW;

    switch (definition.type) {
      case 'ImportBinding':
        return this.importBinding(toNode(definition.node));
      case 'FunctionName':
        return { type: 'shadow', declaration: toNode(definition.node) };
      case 'Parameter':
        return this.parameterBinding(definition);
      case 'Variable':
        return this.isPropVariable(definition)
          ? this.propVariableBinding(variable)
          : this.variableBinding(variable);
      default:
        return SHADOW;
    }
  }

  private importBinding(node: Node): Binding {
    const { host } = this;

    if (node.type === 'TSImportEqualsDeclaration') {
      const reference = node.moduleReference;
      if (reference.type !== 'TSExternalModuleReference') return SHADOW;

      const specifier = reference.expression.value;
      return { type: 'lazy', get: () => host.namespace(specifier) };
    }

    const declaration = this.parents.get(node);
    if (declaration?.type !== 'ImportDeclaration') return SHADOW;

    const specifier = declaration.source.value;
    const importedSymbol = () => {
      if (node.type === 'ImportNamespaceSpecifier')
        return host.namespace(specifier);

      const exportName = importedName(
        node as ESTree.ImportSpecifier | ESTree.ImportDefaultSpecifier
      );

      return host.exportOf(specifier, exportName);
    };

    return { type: 'lazy', declaration: node, get: importedSymbol };
  }

  private parameterBinding(definition: Definition): Binding {
    const fn = toNode(definition.node) as FunctionNode;
    const identifier = toNode(definition.name);

    const index = fn.params.findIndex((parameter) =>
      patternBindings(parameter as Pattern).some(
        (binding) => binding.node === identifier
      )
    );
    const path = pathOf(fn.params[index] as Pattern | undefined, identifier);
    if (index === -1 || !path) return SHADOW;

    const isFirst = index === 0;
    const importedSpecifier = isFirst
      ? dynamicImportOfCallback(fn, this.parents.get(fn))
      : undefined;

    if (importedSpecifier !== undefined) {
      const { host } = this;
      return {
        type: 'lazy',
        get: () => followPath(host.namespace(importedSpecifier), path),
      };
    }

    return {
      type: 'values',
      parameter: true,
      candidates: () => parameterCandidates(fn, this, index, path),
    };
  }

  /** Svelte 4's `export let message` is the prop `message`. */
  private isPropVariable(definition: Definition): boolean {
    const propVariables = this.host.props?.reads.variables;
    const declaredAt = toNode(definition.name).start;

    return propVariables?.includes(declaredAt) ?? false;
  }

  private propVariableBinding(variable: Variable): Binding {
    const own = this.variableBinding(variable);
    const name = variable.name;

    const ownValues = () => (own.type === 'values' ? own.candidates() : []);
    const passedValues = () => {
      const props = this.host.props?.candidates() ?? [];
      return props.map((candidate) => followCandidate(candidate, [name]));
    };

    return {
      type: 'values',
      parameter: true,
      candidates: () => [...ownValues(), ...passedValues()],
    };
  }

  /** A `const` is its initializer; a `let` or `var` may hold any value written to it. */
  private variableBinding(variable: Variable): Binding {
    const initializations: Write[] = [];
    let isConst = false;
    let declaration: Node | undefined;

    for (const definition of variable.defs) {
      if (definition.type !== 'Variable') continue;

      const declarator = toNode(definition.node) as ESTree.VariableDeclarator;
      const statement = toNode(definition.parent) as ESTree.VariableDeclaration;
      isConst = statement.kind === 'const';

      const { init } = declarator;
      const path = pathOf(declarator.id, toNode(definition.name));
      if (!init || !path) continue;

      if (isConst) {
        return {
          type: 'alias',
          init,
          path,
          scope: this,
          declaration: declaredFunction(init),
        };
      }

      declaration ??= declaredFunction(init);
      initializations.push({
        candidate: { type: 'expression', node: init, scope: this, path },
        node: declarator,
        statement: this.exportOrSelf(statement),
      });
    }

    if (isConst) return SHADOW;

    return this.reassignableBinding(variable, initializations, declaration);
  }

  /** `export let t = m` is a statement of its block, as `let t = m` is. */
  private exportOrSelf(statement: Node): Node {
    const parent = this.parents.get(statement);

    return parent?.type === 'ExportNamedDeclaration' ? parent : statement;
  }

  private reassignableBinding(
    variable: Variable,
    initializations: readonly Write[],
    declaration: Node | undefined
  ): Binding {
    let writes: Write[] | undefined;
    const allWrites = () =>
      (writes ??= [...initializations, ...this.assignments(variable)]);

    // `let { message } = $props()`
    const holdsProps = initializations.some(
      ({ candidate }) =>
        candidate.type === 'expression' && readsProps(candidate.node, this)
    );

    return {
      type: 'values',
      declaration,
      parameter: holdsProps,
      candidates: () => allWrites().map((write) => write.candidate),
      at: (read) =>
        this.writesReaching(allWrites(), read).map((write) => write.candidate),
    };
  }

  private assignments(variable: Variable): Write[] {
    const writes: Write[] = [];

    for (const reference of variable.references) {
      if (!reference.isWrite() || reference.init) continue;

      const write = this.assignmentTo(toNode(reference.identifier));
      if (write) writes.push(write);
    }

    return writes;
  }

  /** `t = m` and `({ t } = obj)`; `+=`, `++` and `for (t of …)` write nothing known. */
  private assignmentTo(identifier: Node): Write | undefined {
    for (const { parent, child } of this.ancestry(identifier)) {
      if (parent.type !== 'AssignmentExpression') {
        if (DESTRUCTURING_PARTS.has(parent.type)) continue;
        return undefined;
      }

      const isTarget = child === parent.left;
      const path = isTarget
        ? pathOf(parent.left as Pattern, identifier)
        : undefined;
      if (parent.operator !== '=' || !path) return undefined;

      const statement = this.parents.get(parent);
      const isOwnStatement =
        statement?.type === 'ExpressionStatement' &&
        statement.expression === parent;

      return {
        candidate: {
          type: 'expression',
          node: parent.right,
          scope: this,
          path,
        },
        node: parent,
        statement: isOwnStatement ? statement : undefined,
      };
    }

    return undefined;
  }

  /**
   * A write that is a statement of a block around the read, in the same
   * function, always runs before it and replaces the earlier ones:
   * `let t = m; t = other; t.x()` holds `other`. Without one, every write counts.
   */
  private writesReaching(writes: readonly Write[], read: Node): Write[] {
    const replacing = this.lastReplacingWrite(writes, read);
    if (!replacing) return [...writes];

    const firstPosition = positionOf(replacing.node);
    const readPosition = positionOf(read);

    return writes.filter((write) => {
      const position = positionOf(write.node);
      return position >= firstPosition && position < readPosition;
    });
  }

  private lastReplacingWrite(
    writes: readonly Write[],
    read: Node
  ): Write | undefined {
    const readPosition = positionOf(read);
    const readFunction = this.enclosingFunction(read);
    let last: Write | undefined;

    for (const write of writes) {
      const { statement } = write;
      const isBeforeRead = positionOf(write.node) < readPosition;
      if (!statement || !isBeforeRead) continue;

      const block = this.parents.get(statement);
      const alwaysRunsBeforeRead =
        block !== undefined &&
        BLOCKS.has(block.type) &&
        contains(block, readPosition) &&
        this.enclosingFunction(statement) === readFunction;
      if (!alwaysRunsBeforeRead) continue;

      const isLatest = !last || positionOf(write.node) > positionOf(last.node);
      if (isLatest) last = write;
    }

    return last;
  }
}

function referencesByIdentifier(manager: ScopeManager): Map<Node, Reference> {
  const references = new Map<Node, Reference>();

  for (const scope of manager.scopes) {
    for (const reference of scope.references) {
      references.set(toNode(reference.identifier), reference);
    }
  }

  return references;
}

function parentsByNode(program: ESTree.Program): Map<Node, Node> {
  const parents = new Map<Node, Node>();

  walk(program, {
    enter(node, ancestors) {
      const parent = ancestors.at(-1);
      if (parent) parents.set(node, parent);

      return true;
    },
  });

  return parents;
}

function nameOf(identifier: Node): string | undefined {
  return (identifier as { name?: string }).name;
}

// A node moved to its position in the source file keeps its position in the parsed code in `range`.
function parsedRange(node: Node): readonly [number, number] {
  return (node as { range?: [number, number] }).range ?? [node.start, node.end];
}

function positionOf(node: Node): number {
  return parsedRange(node)[0];
}

function contains(node: Node, position: number): boolean {
  const [start, end] = parsedRange(node);

  return start <= position && position < end;
}

function pathOf(
  pattern: Pattern | undefined,
  identifier: Node
): string[] | undefined {
  if (!pattern) return undefined;

  const binding = patternBindings(pattern).find(
    (candidate) => candidate.node === identifier
  );

  return binding?.path;
}

export function aliasScope(
  binding: Extract<Binding, { type: 'alias' }>
): Scope | undefined {
  return typeof binding.scope === 'function' ? binding.scope() : binding.scope;
}

/** A parameter, a prop, or a `const` of one: `const { message } = Astro.props`. */
export function holdsArguments(
  binding: Binding | undefined,
  depth = 0
): boolean {
  if (binding?.type === 'values') return binding.parameter === true;
  if (binding?.type !== 'alias' || depth > MAX_ALIAS_CHAIN) return false;

  const scope = aliasScope(binding);
  if (!scope) return false;

  const init = unwrapExpression(binding.init);
  if (readsProps(init, scope)) return true;

  return (
    init.type === 'Identifier' &&
    holdsArguments(scope.bindingAt(init), depth + 1)
  );
}

/** `$props()`, `defineProps(…)`, `Astro.props`: whatever the module's language says. */
export function readsProps(expression: Node, scope: Scope): boolean {
  const reads = scope.host.props?.reads;
  if (!reads) return false;

  const node = unwrapExpression(expression);

  if (node.type === 'CallExpression') {
    const callee = unwrapExpression(node.callee);
    return (
      callee.type === 'Identifier' &&
      (reads.calls?.includes(callee.name) ?? false)
    );
  }

  if (node.type !== 'MemberExpression') return false;

  const object = unwrapExpression(node.object);
  const property = staticPropertyName(node);
  if (object.type !== 'Identifier' || property === undefined) return false;

  return reads.members?.includes(`${object.name}.${property}`) ?? false;
}

export function expressionsOf(
  binding: Binding | undefined
): ExpressionCandidate[] {
  if (binding?.type === 'values') {
    return binding
      .candidates()
      .filter((candidate) => candidate.type === 'expression');
  }

  if (binding?.type !== 'alias') return [];

  const scope = aliasScope(binding);
  if (!scope) return [];

  return [
    { type: 'expression', node: binding.init, scope, path: binding.path },
  ];
}

function parameterCandidates(
  fn: FunctionNode,
  scope: Scope,
  index: number,
  path: readonly string[]
): Candidate[] {
  const candidates: Candidate[] = [];
  const sites = scope.host.callSitesOf?.(fn) ?? [];

  for (const site of sites) {
    const argument = argumentOf(site, index);
    if (argument) candidates.push(followCandidate(argument, path));
  }

  // `function show(t = m)` called as `show()` holds `m`.
  const defaultValue = defaultOf(fn.params[index]);
  const isDefaultUsed = sites.some((site) => omitsArgument(site, index));

  if (defaultValue && isDefaultUsed) {
    candidates.push({ type: 'expression', node: defaultValue, scope, path });
  }

  return candidates;
}

/** `m` of the parameter `t = m`, or of the constructor's `private t = m`. */
function defaultOf(parameter: Node | undefined): Node | undefined {
  const pattern =
    parameter?.type === 'TSParameterProperty' ? parameter.parameter : parameter;

  return pattern?.type === 'AssignmentPattern' ? pattern.right : undefined;
}

/** `const f = memo(forwardRef((props) => …))` declares the innermost function. */
function declaredFunction(init: Node): Node | undefined {
  let node = unwrapExpression(init);

  while (node.type === 'CallExpression') {
    const wrapped = node.arguments
      .map((argument) => unwrapExpression(argument))
      .find(
        (argument) => isFunction(argument) || argument.type === 'CallExpression'
      );
    if (!wrapped) return undefined;

    node = wrapped;
  }

  return isFunction(node) ? node : undefined;
}

/** `import("x").then(callback)` → "x" */
function dynamicImportOfCallback(
  callback: FunctionNode,
  parent: Node | undefined
): string | undefined {
  const isFirstArgument =
    parent?.type === 'CallExpression' && parent.arguments[0] === callback;
  if (!isFirstArgument) return undefined;

  const callee = unwrapExpression(parent.callee);
  const isThen =
    callee.type === 'MemberExpression' && staticPropertyName(callee) === 'then';
  if (!isThen) return undefined;

  const promise = unwrapExpression(callee.object);

  return promise.type === 'ImportExpression'
    ? staticString(promise.source)
    : undefined;
}
