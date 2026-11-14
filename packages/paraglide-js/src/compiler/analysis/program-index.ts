import {
  analyze,
  FunctionScope,
  type Definition as ManagedDefinition,
  type Reference as ManagedReference,
  type Scope as ManagedScope,
  type Variable as ManagedVariable,
} from '@typescript-eslint/scope-manager';
import { visitorKeys } from 'oxc-parser';
import {
  forEachNode,
  parsedEnd,
  parsedRange,
  parsedStart,
  type Child,
  type ESTree,
  type Node,
} from './ast.js';

export type Definition = {
  type: ManagedDefinition['type'];
  /** The import specifier, the function or the declarator. */
  node: Node;
  /** The declared identifier. */
  name: Node;
  /** The `VariableDeclaration` or `ImportDeclaration`. */
  parent: Node | undefined;
};

export type Variable = {
  name: string;
  isModuleLevel: boolean;
  /** None for a type. */
  definitions: readonly Definition[];
  /** Assigned identifiers, without initializations. */
  assignments: readonly Node[];
};

/** `variable` is undefined for a global. */
export type Reference = { variable: Variable | undefined; isRead: boolean };

type Variables = {
  /** By name. */
  moduleLevel: ReadonlyMap<string, Variable>;
  /** By identifier. */
  references: ReadonlyMap<Node, Reference>;
};

export type ProgramIndex = Variables & {
  parentOf(node: Node): Node | undefined;
};

/** A program is indexed once: indexing drops the ranges the scope manager reads. */
const indexes = new WeakMap<ESTree.Program, ProgramIndex>();

// Scripts are parsed without `range`, the only thing the scope manager reads it
// for: their `start` is the same. Generated code keeps `range`, where it parsed.
const scopeManagerResolution = FunctionScope.prototype as unknown as {
  isValidResolution(
    reference: ManagedReference,
    variable: ManagedVariable
  ): boolean;
  block: { type: string; body?: object | null };
};
scopeManagerResolution.isValidResolution = function (reference, variable) {
  if (this.block.type === 'Program') return true;

  const body = this.block.body as Node | null | undefined;
  const bodyStart = body ? parsedRange(body)[0] : -1;

  return !(
    variable.scope === (this as unknown) &&
    parsedRange(reference.identifier as unknown as Node)[0] < bodyStart &&
    variable.defs.every(
      (definition) =>
        parsedRange(definition.name as unknown as Node)[0] >= bodyStart
    )
  );
};

// scope-manager is typed for typescript-estree's nodes; it is given oxc's, which have the same shape.
const toNode = (node: object) => node as Node;

/** Keeps only what the analysis reads: the scope manager's objects are several times as large. */
export function indexProgram(program: ESTree.Program): ProgramIndex {
  let index = indexes.get(program);

  if (!index) {
    index = { ...resolveVariables(program), parentOf: parentFinder(program) };
    dropRedundantRanges(program);
    indexes.set(program, index);
  }

  return index;
}

function resolveVariables(program: ESTree.Program): Variables {
  const manager = analyze(program as never, {
    sourceType: 'module',
    lib: [],
    jsxPragma: null,
  });
  const global = manager.globalScope!;
  const topLevel =
    global.childScopes.find((scope) => scope.type === 'module') ?? global;

  const variables = new Map<ManagedVariable, Variable>();
  const variableOf = (managed: ManagedVariable): Variable => {
    let variable = variables.get(managed);

    if (!variable) {
      variable = toVariable(managed, topLevel);
      variables.set(managed, variable);
    }

    return variable;
  };

  const moduleLevel = new Map<string, Variable>();
  for (const [name, managed] of topLevel.set) {
    moduleLevel.set(name, variableOf(managed));
  }

  const references = new Map<Node, Reference>();
  for (const scope of manager.scopes) {
    for (const reference of scope.references) {
      references.set(toNode(reference.identifier), {
        variable: reference.resolved
          ? variableOf(reference.resolved)
          : undefined,
        isRead: reference.isRead(),
      });
    }
  }

  return { moduleLevel, references };
}

/**
 * Finds a node's parent by descending from the program to it, through the
 * children whose position holds it. Few nodes are asked for: a map of every
 * node's parent costs more than the analysis reads.
 */
function parentFinder(
  program: ESTree.Program
): (node: Node) => Node | undefined {
  const parents = new Map<Node, Node>();

  return (node) => {
    if (node === program) return undefined;

    const known = parents.get(node);
    if (known) return known;

    // A child outside its parent's position, e.g. a decorator, is found without pruning.
    const path = pathTo(program, node, true) ?? pathTo(program, node, false);
    if (!path) return undefined;

    for (let index = 1; index < path.length; index++) {
      parents.set(path[index]!, path[index - 1]!);
    }

    return parents.get(node);
  };
}

/** The nodes from `root` to `target`; with `prune`, only through nodes whose parsed range holds the target's. */
function pathTo(root: Node, target: Node, prune: boolean): Node[] | undefined {
  const start = parsedStart(target);
  const end = parsedEnd(target);
  const path: Node[] = [];

  const visitChild = (child: Node | null | undefined): boolean => {
    if (!child) return false;
    if (prune && (parsedStart(child) > start || parsedEnd(child) < end))
      return false;

    return visit(child);
  };

  const visit = (node: Node): boolean => {
    path.push(node);
    if (node === target) return true;

    for (const key of (visitorKeys[node.type] ?? []) as (keyof Node)[]) {
      const value = node[key] as Child;

      if (!Array.isArray(value)) {
        if (visitChild(value)) return true;
        continue;
      }

      // Siblings are in parsing order: those that start after the target cannot hold it.
      const last = prune ? lastStartingBy(value, start) : value.length - 1;
      for (let index = last; index >= 0; index--) {
        if (visitChild(value[index])) return true;
      }
    }

    path.pop();
    return false;
  };

  return visit(root) ? path : undefined;
}

/** The index of the last of `nodes` that starts at or before `position`; -1 if none does. */
function lastStartingBy(
  nodes: readonly (Node | null)[],
  position: number
): number {
  let low = 0;
  let high = nodes.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    const node = nodes[middle];
    const startsBy = !node || parsedStart(node) <= position;

    if (startsBy) low = middle + 1;
    else high = middle;
  }

  return low - 1;
}

/** Each `range` that repeats `start` and `end`: a third of a program's memory, when it was parsed with ranges. */
function dropRedundantRanges(program: ESTree.Program): void {
  if (!(program as { range?: unknown }).range) return;

  forEachNode(program, (node) => {
    const { range } = node as { range?: [number, number] };
    const isRedundant = range?.[0] === node.start && range[1] === node.end;

    if (isRedundant) (node as { range?: [number, number] }).range = undefined;
  });
}

function toVariable(
  managed: ManagedVariable,
  topLevel: ManagedScope
): Variable {
  // `type Message = …` and `function Message()` are one variable; the value counts.
  const valueDefinitions = managed.isValueVariable
    ? managed.defs.filter((definition) => definition.type !== 'Type')
    : [];

  return {
    name: managed.name,
    isModuleLevel: managed.scope === topLevel,
    definitions: valueDefinitions.map(toDefinition),
    assignments: managed.references
      .filter((reference) => reference.isWrite() && !reference.init)
      .map((reference) => toNode(reference.identifier)),
  };
}

function toDefinition(managed: ManagedDefinition): Definition {
  return {
    type: managed.type,
    node: toNode(managed.node),
    name: toNode(managed.name),
    parent: managed.parent ? toNode(managed.parent) : undefined,
  };
}
