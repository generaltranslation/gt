import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformConcatenation } from '../transformConcatenation';

function transformCode(code: string): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
  generatedMessage: string;
  generatedVariables: string | null;
} {
  let result!: ReturnType<typeof transformConcatenation>;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    BinaryExpression(path) {
      if (path.parentPath?.isBinaryExpression()) return;
      result = transformConcatenation(path);
      path.stop();
    },
  });
  return {
    ...result,
    generatedMessage: generate(result.message).code,
    generatedVariables: result.variables
      ? generate(result.variables).code
      : null,
  };
}

function transformWithImports(code: string) {
  let result!: ReturnType<typeof transformConcatenation>;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    BinaryExpression(path) {
      if (path.parentPath?.isBinaryExpression()) return;
      result = transformConcatenation(path);
      path.stop();
    },
  });
  return {
    ...result,
    generatedMessage: generate(result.message).code,
    generatedVariables: result.variables
      ? generate(result.variables).code
      : null,
  };
}

describe('transformConcatenation', () => {
  // --- basic cases ---

  it('"Hello, " + name → message "Hello, {0}", vars { "0": name }', () => {
    const { generatedMessage, generatedVariables } =
      transformCode('"Hello, " + name');
    expect(generatedMessage).toBe('"Hello, {0}"');
    expect(generatedVariables).toContain('"0": name');
  });

  it('"a" + "b" → message "ab", no vars', () => {
    const { message, generatedMessage, variables } = transformCode('"a" + "b"');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ab"');
    expect(variables).toBeNull();
  });

  it('"a" + name + "b" → "a{0}b"', () => {
    const { generatedMessage, generatedVariables } =
      transformCode('"a" + name + "b"');
    expect(generatedMessage).toBe('"a{0}b"');
    expect(generatedVariables).toContain('"0": name');
  });

  it('"a" + b + "c" + d + "e" → "a{0}c{1}e"', () => {
    const { generatedMessage, variables } = transformCode(
      '"a" + b + "c" + d + "e"'
    );
    expect(generatedMessage).toBe('"a{0}c{1}e"');
    expect(variables!.properties).toHaveLength(2);
  });

  it('x + "" → "{0}"', () => {
    const { generatedMessage, variables } = transformCode('x + ""');
    expect(generatedMessage).toBe('"{0}"');
    expect(variables!.properties).toHaveLength(1);
  });

  // --- recursive simplification ---

  it('"A" + `B${"C"}` → "ABC" (template with static expr)', () => {
    const { message, generatedMessage, variables } =
      transformCode('"A" + `B${"C"}`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ABC"');
    expect(variables).toBeNull();
  });

  it('"A" + `B${name}C` → "AB{0}C"', () => {
    const { generatedMessage, generatedVariables } =
      transformCode('"A" + `B${name}C`');
    expect(generatedMessage).toBe('"AB{0}C"');
    expect(generatedVariables).toContain('"0": name');
  });

  it('"count: " + 42 → "count: 42"', () => {
    const { generatedMessage, variables } = transformCode('"count: " + 42');
    expect(generatedMessage).toBe('"count: 42"');
    expect(variables).toBeNull();
  });

  it('true + " value" → "true value"', () => {
    const { generatedMessage } = transformCode('true + " value"');
    expect(generatedMessage).toBe('"true value"');
  });

  // --- derive cases ---

  it('"Hello " + derive(getName()) → `Hello ${derive(getName())}`', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n"Hello " + derive(getName())`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    expect(generatedMessage).toContain('derive(getName())');
    expect(generatedMessage).toContain('Hello ');
    expect(variables).toBeNull();
  });

  it('derive(a) + derive(b) → `${derive(a)}${derive(b)}`', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\nderive(a) + derive(b)`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(2);
    expect(generatedMessage).toContain('derive(a)');
    expect(generatedMessage).toContain('derive(b)');
    expect(variables).toBeNull();
  });

  it('"A" + derive(x) + "B" + derive(y) + "C" → `A${derive(x)}B${derive(y)}C`', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n"A" + derive(x) + "B" + derive(y) + "C"`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(2);
    expect(tl.quasis).toHaveLength(3);
    expect(tl.quasis[0].value.raw).toBe('A');
    expect(tl.quasis[1].value.raw).toBe('B');
    expect(tl.quasis[2].value.raw).toBe('C');
    expect(generatedMessage).toContain('derive(x)');
    expect(generatedMessage).toContain('derive(y)');
    expect(variables).toBeNull();
  });

  it('derive(x) + name → `${derive(x)}{0}` with vars', () => {
    const { message, generatedVariables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\nderive(x) + name`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1); // derive
    expect(tl.quasis[0].value.raw).toBe(''); // before derive
    expect(tl.quasis[1].value.raw).toBe('{0}'); // after derive, contains placeholder
    expect(generatedVariables).toContain('"0": name');
  });

  it('"A" + derive(x) + "B" + name + "C" + derive(y) + "D" → mixed derive + dynamic', () => {
    const { message, generatedVariables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n"A" + derive(x) + "B" + name + "C" + derive(y) + "D"`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(2); // two derives
    expect(tl.quasis[0].value.raw).toBe('A');
    expect(tl.quasis[1].value.raw).toBe('B{0}C');
    expect(tl.quasis[2].value.raw).toBe('D');
    expect(generatedVariables).toContain('"0": name');
  });

  it('derive at start: derive(x) + "A" → `${derive(x)}A`', () => {
    const { message } = transformWithImports(
      `import { derive } from 'gt-react/browser';\nderive(x) + "A"`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.quasis[0].value.raw).toBe('');
    expect(tl.quasis[1].value.raw).toBe('A');
  });

  it('derive at end: "A" + derive(x) → `A${derive(x)}`', () => {
    const { message } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n"A" + derive(x)`
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.quasis[0].value.raw).toBe('A');
    expect(tl.quasis[1].value.raw).toBe('');
  });

  it('derive inside nested template in concatenation', () => {
    const code = `import { derive } from 'gt-react/browser';\n"A" + \`B\${derive(x)}C\``;
    const { message, generatedMessage, variables } = transformWithImports(code);
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1);
    expect(tl.quasis[0].value.raw).toBe('AB');
    expect(tl.quasis[1].value.raw).toBe('C');
    expect(generatedMessage).toContain('derive(x)');
    expect(variables).toBeNull();
  });
});
