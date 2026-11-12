import {
  analyze,
  type Definition as ManagedDefinition,
  type Scope as ManagedScope,
  type Variable as ManagedVariable,
} from '@typescript-eslint/scope-manager';
import { forEachNode, type ESTree, type Node } from './ast.js';

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
  parents: ReadonlyMap<Node, Node>;
};

/** A program is indexed once: indexing drops the ranges the scope manager reads. */
const indexes = new WeakMap<ESTree.Program, ProgramIndex>();

// scope-manager is typed for typescript-estree's nodes; it is given oxc's, which have the same shape.
const toNode = (node: object) => node as Node;

/** Keeps only what the analysis reads: the scope manager's objects are several times as large. */
export function indexProgram(program: ESTree.Program): ProgramIndex {
  let index = indexes.get(program);

  if (!index) {
    index = { ...resolveVariables(program), parents: readParents(program) };
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

/** Also drops each `range` that repeats `start` and `end`: a third of the AST's memory. */
function readParents(program: ESTree.Program): Map<Node, Node> {
  const parents = new Map<Node, Node>();

  forEachNode(program, (node, parent) => {
    if (parent) parents.set(node, parent);
    dropRedundantRange(node);
  });

  return parents;
}

function dropRedundantRange(node: Node): void {
  const { range } = node as { range?: [number, number] };
  const isRedundant = range?.[0] === node.start && range[1] === node.end;

  if (isRedundant) (node as { range?: [number, number] }).range = undefined;
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
