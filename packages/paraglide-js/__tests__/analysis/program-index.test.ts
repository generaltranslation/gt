import { describe, expect, test } from 'vitest';
import {
  forEachNode,
  type ESTree,
  type Node,
} from '../../src/compiler/analysis/ast.js';
import { indexProgram } from '../../src/compiler/analysis/program-index.js';
import {
  Scope,
  type Binding,
  type ModuleHost,
} from '../../src/compiler/analysis/scope.js';
import { remapProgram } from '../../src/compiler/languages/mapping.js';
import { parseCode } from '../../src/compiler/utils/parse.js';

const HOST: ModuleHost = {
  namespace: () => undefined,
  exportOf: () => undefined,
};

function parse(code: string): ESTree.Program {
  const { program } = parseCode('/app/a.ts', code, {
    lang: 'ts',
    range: true,
    astType: 'ts',
  });

  return program as unknown as ESTree.Program;
}

function identifiers(program: ESTree.Program, name: string): Node[] {
  const found: Node[] = [];

  forEachNode(program, (node) => {
    if (node.type === 'Identifier' && node.name === name) found.push(node);
  });

  return found;
}

function rangeOf(node: Node): [number, number] | undefined {
  return (node as { range?: [number, number] }).range;
}

describe('indexProgram', () => {
  test('indexes a program once', () => {
    const program = parse(
      'let a = 1;\na = 2;\nfunction f(a) { return a; }\nf(a);'
    );

    const index = indexProgram(program);
    const [declared, assigned, parameter, returned, argument] = identifiers(
      program,
      'a'
    );
    const called = identifiers(program, 'f').at(-1);
    const moduleLevel = index.moduleLevel.get('a');

    expect(indexProgram(program)).toBe(index);
    expect(
      moduleLevel?.definitions.map((definition) => definition.name)
    ).toEqual([declared]);
    expect(moduleLevel?.assignments).toEqual([assigned]);
    expect(index.references.get(argument!)?.variable).toBe(moduleLevel);
    expect(index.references.get(returned!)?.variable?.isModuleLevel).toBe(
      false
    );
    expect(index.references.get(parameter!)).toBeUndefined();
    expect(index.parentOf(called!)?.type).toBe('CallExpression');
  });

  test('drops the ranges that repeat start and end', () => {
    const program = parse('const a = { b: [1, 2] };');

    indexProgram(program);

    forEachNode(program, (node) => expect(rangeOf(node)).toBeUndefined());
  });

  test('keeps the ranges of generated code that differ from its source positions', () => {
    const code = 'a;\nb;';
    const program = parse(code);
    // `a;` stays in place, `b;` comes from source offset 13.
    remapProgram(
      program,
      [
        { generated: 0, source: 0, length: 2 },
        { generated: 3, source: 13, length: 2 },
      ],
      code.length
    );

    indexProgram(program);

    const [a] = identifiers(program, 'a');
    const [b] = identifiers(program, 'b');
    expect(rangeOf(a!)).toBeUndefined();
    expect(b).toMatchObject({ start: 13, end: 14, range: [3, 4] });
  });
});

describe('Scope', () => {
  test('scopes of one program keep their own implicit names', () => {
    const program = parse('t("title");');
    const [t] = identifiers(program, 't');
    const binding: Binding = { type: 'lazy', get: () => undefined };

    const withName = new Scope(program, HOST, (name) =>
      name === 't' ? binding : undefined
    );
    const withoutName = new Scope(program, HOST);

    expect(withName.bindingAt(t!)).toBe(binding);
    expect(withoutName.bindingAt(t!)).toBeUndefined();
    expect(withName.isGlobal(t!)).toBe(true);
  });
});
