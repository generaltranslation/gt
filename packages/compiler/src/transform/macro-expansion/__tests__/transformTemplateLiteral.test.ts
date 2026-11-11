import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformTemplateLiteral } from '../transformTemplateLiteral';

/**
 * Transforms the first template literal in `code` and returns the generated
 * message plus the variables as { key: generated value }.
 */
function transformCode(code: string): {
  message: string;
  variables: Record<string, string> | null;
} {
  let result!: ReturnType<typeof transformTemplateLiteral>;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    TemplateLiteral(path) {
      result = transformTemplateLiteral(path);
      path.stop();
    },
  });
  expect(result.errors).toEqual([]);
  expect(result.content).toHaveLength(1);
  const { message, variables } = result.content[0];
  return {
    message: generate(message).code,
    variables:
      variables &&
      Object.fromEntries(
        (variables.properties as t.ObjectProperty[]).map((prop) => [
          (prop.key as t.StringLiteral).value,
          generate(prop.value).code,
        ])
      ),
  };
}

const DERIVE_IMPORT = `import { derive } from 'gt-react/browser';\n`;

type Case = [
  source: string,
  message: string,
  variables: Record<string, string> | null,
];

describe('transformTemplateLiteral', () => {
  it.each<Case>([
    // Static templates become string literals
    ['`Hello world`', '"Hello world"', null],
    ['``', '""', null],
    // Dynamic expressions become numbered placeholders
    ['`Hello, ${name}`', '"Hello, {0}"', { 0: 'name' }],
    ['`${name}, ${greeting}!`', '"{0}, {1}!"', { 0: 'name', 1: 'greeting' }],
    ['`${a}${b}`', '"{0}{1}"', { 0: 'a', 1: 'b' }],
    ['`Hello, ${user.name}`', '"Hello, {0}"', { 0: 'user.name' }],
    // + is flattened as concatenation
    ['`Result: ${a + b}`', '"Result: {0}{1}"', { 0: 'a', 1: 'b' }],
    // Static expressions are folded into the message
    ['`A${"B"}C`', '"ABC"', null],
    ['`A${`B`}C`', '"ABC"', null],
    ['`${42} items`', '"42 items"', null],
    ['`${true} flag`', '"true flag"', null],
    ['`A${`B${"C"}D`}E`', '"ABCDE"', null],
    ['`${"A" + "B"}C`', '"ABC"', null],
    ['`A${"B"}${name}C${"D"}`', '"AB{0}CD"', { 0: 'name' }],
  ])('%s -> %s', (source, message, variables) => {
    expect(transformCode(source)).toEqual({ message, variables });
  });

  // derive() calls stay in a template literal; everything else is folded or
  // replaced by a placeholder around them
  it.each<Case>([
    ['`Hello ${derive(getName())}`', '`Hello ${derive(getName())}`', null],
    ['`${derive(x)}`', '`${derive(x)}`', null],
    ['`${derive(a)}${derive(b)}`', '`${derive(a)}${derive(b)}`', null],
    ['`A${derive(x)}B${derive(y)}C`', '`A${derive(x)}B${derive(y)}C`', null],
    [
      '`X${derive(a)}Y${derive(b)}Z${derive(c)}W`',
      '`X${derive(a)}Y${derive(b)}Z${derive(c)}W`',
      null,
    ],
    ['`${derive(x)}${name}`', '`${derive(x)}{0}`', { 0: 'name' }],
    [
      '`${name}${derive(x)}${greeting}`',
      '`{0}${derive(x)}{1}`',
      { 0: 'name', 1: 'greeting' },
    ],
    ['`A${"B"}${derive(x)}${"C"}D`', '`AB${derive(x)}CD`', null],
  ])('%s -> %s (derive preserved)', (source, message, variables) => {
    expect(transformCode(DERIVE_IMPORT + source)).toEqual({
      message,
      variables,
    });
  });
});
