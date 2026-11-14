import {
  forEachNode,
  type ESTree,
  type Node,
} from '../../src/compiler/analysis/ast.js';
import type {
  Variable,
  Variables,
} from '../../src/compiler/analysis/program-index.js';

/**
 * How `actual` differs from `expected`, for the same program: each
 * identifier's reference, the variable it resolves to and whether it reads
 * it, each variable's definitions and assignments in order, and the
 * module-level names in order. Empty when they are the same.
 */
export function differences(
  program: ESTree.Program,
  expected: Variables,
  actual: Variables
): string[] {
  const found: string[] = [];
  const pairs = new Map<Variable, Variable>();
  const paired = new Set<Variable>();
  const where = (node: Node) =>
    `${(node as { name?: string }).name ?? node.type}@${node.start}`;

  const pair = (
    a: Variable | undefined,
    b: Variable | undefined,
    at: string
  ) => {
    if (!a || !b) {
      if (a !== b) found.push(`${at}: variable ${a?.name} vs ${b?.name}`);
      return;
    }

    const known = pairs.get(a);
    if (known) {
      if (known !== b)
        found.push(`${at}: ${a.name} resolves to another variable`);
      return;
    }
    if (paired.has(b)) {
      found.push(`${at}: ${b.name} stands for two variables`);
      return;
    }

    pairs.set(a, b);
    paired.add(b);
    found.push(...variableDifferences(a, b, where));
  };

  if (expected.references.size !== actual.references.size) {
    found.push(
      `references: ${expected.references.size} vs ${actual.references.size}`
    );
  }

  forEachNode(program, (node) => {
    const a = expected.references.get(node);
    const b = actual.references.get(node);
    if (!a && !b) return;

    const at = where(node);
    if (!a || !b) {
      found.push(`${at}: reference ${a ? 'missing' : 'extra'}`);
      return;
    }
    if (a.isRead !== b.isRead)
      found.push(`${at}: isRead ${a.isRead} vs ${b.isRead}`);
    pair(a.variable, b.variable, at);
  });

  const expectedNames = [...expected.moduleLevel.keys()];
  const actualNames = [...actual.moduleLevel.keys()];
  if (expectedNames.join() !== actualNames.join()) {
    found.push(
      `module level: ${expectedNames.join()} vs ${actualNames.join()}`
    );
  }
  for (const [name, variable] of expected.moduleLevel) {
    pair(variable, actual.moduleLevel.get(name), `module level ${name}`);
  }

  return found;
}

function variableDifferences(
  a: Variable,
  b: Variable,
  where: (node: Node) => string
): string[] {
  const found: string[] = [];
  const at = `variable ${a.name}`;

  if (a.name !== b.name) found.push(`${at}: name ${b.name}`);
  if (a.isModuleLevel !== b.isModuleLevel) found.push(`${at}: isModuleLevel`);

  const definitions = (variable: Variable) =>
    variable.definitions.map(({ type, node, name, parent }) => [
      type,
      node,
      name,
      parent,
    ]);
  const [aDefinitions, bDefinitions] = [definitions(a), definitions(b)];
  const sameDefinitions =
    aDefinitions.length === bDefinitions.length &&
    aDefinitions.every((definition, index) =>
      definition.every((part, field) => part === bDefinitions[index]![field])
    );
  if (!sameDefinitions) found.push(`${at}: definitions differ`);

  const sameAssignments =
    a.assignments.length === b.assignments.length &&
    a.assignments.every((node, index) => node === b.assignments[index]);
  if (!sameAssignments) {
    found.push(
      `${at}: assignments ${a.assignments.map(where)} vs ${b.assignments.map(where)}`
    );
  }

  return found;
}
