import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { handleDerivation } from '../handleDerivation.js';
import { nodeToStrings } from '../../../parseString.js';

const traverse = traverseModule.default || traverseModule;

const FILE_PATH = 'test.tsx';

const parseCode = (code: string) =>
  parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

describe('handleDerivation', () => {
  /**
   * Runs handleDerivation on the first expression statement of `code`. For a
   * tagged template statement the template is derived.
   */
  function derive(
    code: string,
    { skipDeriveInvocation = false }: { skipDeriveInvocation?: boolean } = {}
  ) {
    let result: ReturnType<typeof handleDerivation> = null;
    const errors: string[] = [];
    traverse(parseCode(code), {
      ExpressionStatement(path: NodePath<t.ExpressionStatement>) {
        const statement = path.node.expression;
        const isTemplate = t.isTaggedTemplateExpression(statement);
        result = handleDerivation({
          expr: isTemplate ? statement.quasi : statement,
          tPath: isTemplate ? path.get('expression') : path,
          file: FILE_PATH,
          parsingOptions: { conditionNames: [] },
          errors,
          warnings: new Set(),
          skipDeriveInvocation,
        });
        path.stop();
      },
    });
    return { result, errors };
  }

  const text = (value: string) => ({ type: 'text', text: value });
  const sequence = (...nodes: unknown[]) => ({ type: 'sequence', nodes });
  const choice = (...nodes: unknown[]) => ({ type: 'choice', nodes });

  // [expression, options, result, number of errors]
  it.each<[string, Parameters<typeof derive>[1], unknown, number]>([
    // Static expressions (parenthesized so the string is not a directive)
    ['("hello")', {}, text('hello'), 0],
    ['42', {}, text('42'), 0],
    ['true', {}, text('true'), 0],
    ['null', {}, text('null'), 0],
    ['"A" + "B"', {}, sequence(text('A'), text('B')), 0],

    // Dynamic expressions cannot be derived
    ['name', {}, null, 0],
    ['"A" + name', {}, null, 0],
    ['foo()', {}, null, 1],

    // Autoderive resolves identifiers through their const binding
    [
      'const greeting = "hello";\ngreeting',
      { skipDeriveInvocation: true },
      choice(text('hello')),
      0,
    ],
    [
      'const name = "world";\n`Hello ${name}`',
      { skipDeriveInvocation: true },
      sequence(text('Hello '), choice(text('world'))),
      0,
    ],
    ['("hello")', { skipDeriveInvocation: true }, text('hello'), 0],
    [
      '"A" + "B"',
      { skipDeriveInvocation: true },
      sequence(text('A'), text('B')),
      0,
    ],
    ['unknown', { skipDeriveInvocation: true }, null, 0],
    ['foo()', { skipDeriveInvocation: true }, null, 1],
  ])('%s with %j', (code, options, expected, errorCount) => {
    const { result, errors } = derive(code, options);

    expect(result).toEqual(expected);
    expect(errors).toHaveLength(errorCount);
  });

  it('names the function in the error for a call that is not derive()', () => {
    expect(derive('foo()').errors).toEqual([expect.stringContaining('foo')]);
  });

  it('derives a template only when it is static', () => {
    expect(derive('t`Hello, ${name}`').result).toBeNull();
    expect(nodeToStrings(derive('t`Hello, ${"world"}`').result)).toEqual([
      'Hello, world',
    ]);
  });
});
