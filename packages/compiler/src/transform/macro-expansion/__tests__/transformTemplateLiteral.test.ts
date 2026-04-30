import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformTemplateLiteral } from '../transformTemplateLiteral';

function transformCode(code: string): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
  generatedMessage: string;
  generatedVariables: string | null;
} {
  let result!: ReturnType<typeof transformTemplateLiteral>;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    TemplateLiteral(path) {
      if (path.parentPath?.isTemplateLiteral()) return;
      result = transformTemplateLiteral(path);
      path.stop();
    },
  });
  expect(result.errors).toEqual([]);
  if (!result.message) {
    throw new Error('Expected transformTemplateLiteral to return a message');
  }
  return {
    ...result,
    message: result.message,
    variables: result.variables ?? null,
    generatedMessage: generate(result.message).code,
    generatedVariables: result.variables
      ? generate(result.variables).code
      : null,
  };
}

function transformWithImports(code: string) {
  let result!: ReturnType<typeof transformTemplateLiteral>;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    TemplateLiteral(path) {
      if (path.parentPath?.isTemplateLiteral()) return;
      result = transformTemplateLiteral(path);
      path.stop();
    },
  });
  expect(result.errors).toEqual([]);
  if (!result.message) {
    throw new Error('Expected transformTemplateLiteral to return a message');
  }
  return {
    ...result,
    message: result.message,
    variables: result.variables ?? null,
    generatedMessage: generate(result.message).code,
    generatedVariables: result.variables
      ? generate(result.variables).code
      : null,
  };
}

describe('transformTemplateLiteral', () => {
  // --- basic cases ---

  it('`Hello world` → "Hello world"', () => {
    const { message, generatedMessage, variables } =
      transformCode('`Hello world`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"Hello world"');
    expect(variables).toBeNull();
  });

  it('`Hello, ${name}` → "Hello, {0}" with vars', () => {
    const { generatedMessage, generatedVariables } =
      transformCode('`Hello, ${name}`');
    expect(generatedMessage).toBe('"Hello, {0}"');
    expect(generatedVariables).toContain('"0": name');
  });

  it('`${name}, ${greeting}!` → "{0}, {1}!"', () => {
    const { generatedMessage, variables } = transformCode(
      '`${name}, ${greeting}!`'
    );
    expect(generatedMessage).toBe('"{0}, {1}!"');
    expect(variables!.properties).toHaveLength(2);
  });

  it('`` → ""', () => {
    const { message, generatedMessage, variables } = transformCode('``');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('""');
    expect(variables).toBeNull();
  });

  it('`${a}${b}` → "{0}{1}"', () => {
    const { generatedMessage, variables } = transformCode('`${a}${b}`');
    expect(generatedMessage).toBe('"{0}{1}"');
    expect(variables!.properties).toHaveLength(2);
  });

  it('`Hello, ${user.name}` → "Hello, {0}"', () => {
    const { generatedMessage } = transformCode('`Hello, ${user.name}`');
    expect(generatedMessage).toBe('"Hello, {0}"');
  });

  it('`Result: ${a + b}` → "Result: {0}{1}" (+ is flattened as concat)', () => {
    const { generatedMessage, variables } = transformCode('`Result: ${a + b}`');
    expect(generatedMessage).toBe('"Result: {0}{1}"');
    expect(variables!.properties).toHaveLength(2);
  });

  // --- recursive simplification ---

  it('`A${"B"}C` → "ABC" (static string expr)', () => {
    const { message, generatedMessage, variables } =
      transformCode('`A${"B"}C`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ABC"');
    expect(variables).toBeNull();
  });

  it('`A${`B`}C` → "ABC" (nested template)', () => {
    const { message, generatedMessage } = transformCode('`A${`B`}C`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ABC"');
  });

  it('`${42} items` → "42 items" (numeric expr)', () => {
    const { generatedMessage, variables } = transformCode('`${42} items`');
    expect(generatedMessage).toBe('"42 items"');
    expect(variables).toBeNull();
  });

  it('`${true} flag` → "true flag" (boolean expr)', () => {
    const { generatedMessage } = transformCode('`${true} flag`');
    expect(generatedMessage).toBe('"true flag"');
  });

  it('`A${`B${"C"}D`}E` → "ABCDE" (deeply nested)', () => {
    const { message, generatedMessage } = transformCode('`A${`B${"C"}D`}E`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ABCDE"');
  });

  it('`${"A" + "B"}C` → "ABC" (concatenation inside template)', () => {
    const { message, generatedMessage } = transformCode('`${"A" + "B"}C`');
    expect(t.isStringLiteral(message)).toBe(true);
    expect(generatedMessage).toBe('"ABC"');
  });

  it('`A${"B"}${name}C${"D"}` → "AB{0}CD" (mixed static/dynamic)', () => {
    const { generatedMessage, variables } = transformCode(
      '`A${"B"}${name}C${"D"}`'
    );
    expect(generatedMessage).toBe('"AB{0}CD"');
    expect(variables!.properties).toHaveLength(1);
  });

  // --- derive cases ---

  it('`Hello ${derive(getName())}` → template with derive preserved', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`Hello \${derive(getName())}\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1);
    expect(tl.quasis[0].value.raw).toBe('Hello ');
    expect(tl.quasis[1].value.raw).toBe('');
    expect(generatedMessage).toContain('derive(getName())');
    expect(variables).toBeNull();
  });

  it('`${derive(a)}${derive(b)}` → two derive expressions, no vars', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`\${derive(a)}\${derive(b)}\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(2);
    expect(tl.quasis).toHaveLength(3);
    expect(tl.quasis[0].value.raw).toBe('');
    expect(tl.quasis[1].value.raw).toBe('');
    expect(tl.quasis[2].value.raw).toBe('');
    expect(generatedMessage).toContain('derive(a)');
    expect(generatedMessage).toContain('derive(b)');
    expect(variables).toBeNull();
  });

  it('`A${derive(x)}B${derive(y)}C` → quasis A, B, C with two derives', () => {
    const { message, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`A\${derive(x)}B\${derive(y)}C\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(2);
    expect(tl.quasis[0].value.raw).toBe('A');
    expect(tl.quasis[1].value.raw).toBe('B');
    expect(tl.quasis[2].value.raw).toBe('C');
    expect(variables).toBeNull();
  });

  it('`${derive(x)}${name}` → derive expr + {0} placeholder', () => {
    const { message, generatedVariables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`\${derive(x)}\${name}\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1); // derive
    expect(tl.quasis[0].value.raw).toBe(''); // before derive
    expect(tl.quasis[1].value.raw).toBe('{0}'); // after derive, placeholder for name
    expect(generatedVariables).toContain('"0": name');
  });

  it('`${name}${derive(x)}${greeting}` → dynamic, derive, dynamic', () => {
    const { message, generatedVariables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`\${name}\${derive(x)}\${greeting}\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1); // only derive is a template expr
    expect(tl.quasis[0].value.raw).toBe('{0}'); // name placeholder
    expect(tl.quasis[1].value.raw).toBe('{1}'); // greeting placeholder
    expect(generatedVariables).toContain('"0": name');
    expect(generatedVariables).toContain('"1": greeting');
  });

  it('`A${"B"}${derive(x)}${"C"}D` → static collapsed around derive', () => {
    const { message, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`A\${"B"}\${derive(x)}\${"C"}D\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1); // derive
    expect(tl.quasis[0].value.raw).toBe('AB');
    expect(tl.quasis[1].value.raw).toBe('CD');
    expect(variables).toBeNull();
  });

  it('`${derive(x)}` → just the derive, no static text', () => {
    const { message, generatedMessage, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`\${derive(x)}\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1);
    expect(tl.quasis[0].value.raw).toBe('');
    expect(tl.quasis[1].value.raw).toBe('');
    expect(generatedMessage).toContain('derive(x)');
    expect(variables).toBeNull();
  });

  it('three derives with text between each', () => {
    const { message, variables } = transformWithImports(
      `import { derive } from 'gt-react/browser';\n\`X\${derive(a)}Y\${derive(b)}Z\${derive(c)}W\``
    );
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(3);
    expect(tl.quasis).toHaveLength(4);
    expect(tl.quasis[0].value.raw).toBe('X');
    expect(tl.quasis[1].value.raw).toBe('Y');
    expect(tl.quasis[2].value.raw).toBe('Z');
    expect(tl.quasis[3].value.raw).toBe('W');
    expect(variables).toBeNull();
  });
});
