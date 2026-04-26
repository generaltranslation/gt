import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { extractString } from '../extractString';
import type { ResolutionNode } from '../../../nodes/types';
import { isChoiceNode } from '../../../nodes/guards';

function withExpressionPath(
  code: string,
  callback: (path: NodePath<t.Expression>) => void
) {
  const wrappedCode = `const __test__ = ${code};`;
  const ast = parser.parse(wrappedCode, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    VariableDeclarator(path) {
      const init = path.get('init');
      if (init.node) {
        callback(init as NodePath<t.Expression>);
      }
      path.stop();
    },
  });
}

function extractFromCode(code: string) {
  let result: ReturnType<typeof extractString> | undefined;
  withExpressionPath(code, (path) => {
    result = extractString(path);
  });
  return result!;
}

function extractFromModule(code: string) {
  let result: ReturnType<typeof extractString> | undefined;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    ExpressionStatement(path) {
      result = extractString(path.get('expression') as NodePath<t.Expression>);
      path.stop();
    },
  });
  return result!;
}

function staticParts(
  value: ResolutionNode<{ type: string; content: unknown }>[]
): string[] {
  return value
    .filter(
      (p): p is { type: 'static'; content: string } =>
        !isChoiceNode(p) && p.type === 'static'
    )
    .map((p) => p.content);
}

// ─────────────────────────────────────────────────
// Static literals
// ─────────────────────────────────────────────────

describe('extractString — static literals', () => {
  it('extracts string literal', () => {
    const { errors, value } = extractFromCode('"Hello"');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello' });
  });

  it('extracts numeric literal', () => {
    const { errors, value } = extractFromCode('42');
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: '42' });
  });

  it('extracts boolean literal', () => {
    const { errors, value } = extractFromCode('true');
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: 'true' });
  });

  it('extracts null literal', () => {
    const { errors, value } = extractFromCode('null');
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: 'null' });
  });

  it('extracts empty string', () => {
    const { errors, value } = extractFromCode('""');
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: '' });
  });
});

// ─────────────────────────────────────────────────
// String concatenation
// ─────────────────────────────────────────────────

describe('extractString — concatenation', () => {
  it('coalesces adjacent static parts from "A" + "B"', () => {
    const { errors, value } = extractFromCode('"A" + "B"');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'AB' });
  });

  it('coalesces three chained literals: "A" + "B" + "C"', () => {
    const { errors, value } = extractFromCode('"A" + "B" + "C"');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'ABC' });
  });

  it('coalesces string + numeric: "Count: " + 5', () => {
    const { errors, value } = extractFromCode('"Count: " + 5');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'Count: 5' });
  });

  it('keeps dynamic part between static parts', () => {
    const { errors, value } = extractFromCode('"Hello " + name + "!"');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(3);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello ' });
    expect((value![1] as { type: string }).type).toBe('dynamic');
    expect(value![2]).toEqual({ type: 'static', content: '!' });
  });
});

// ─────────────────────────────────────────────────
// Template literals
// ─────────────────────────────────────────────────

describe('extractString — template literals', () => {
  it('extracts plain template literal', () => {
    const { errors, value } = extractFromCode('`hello`');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'hello' });
  });

  it('extracts template with static expression: `Hello ${"World"}`', () => {
    const { errors, value } = extractFromCode('`Hello ${"World"}`');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello World' });
  });

  it('extracts template with dynamic expression: `Hello ${name}`', () => {
    const { errors, value } = extractFromCode('`Hello ${name}`');
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello ' });
    expect((value![1] as { type: string }).type).toBe('dynamic');
  });

  it('extracts nested template: `A ${`B ${"C"}`}`', () => {
    const { errors, value } = extractFromCode('`A ${`B ${"C"}`}`');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'A B C' });
  });

  it('errors on invalid escape sequence', () => {
    const ast = parser.parse('`\\unicode`', {
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true,
    });
    let result: ReturnType<typeof extractString> | undefined;
    traverse(ast, {
      ExpressionStatement(path) {
        result = extractString(
          path.get('expression') as NodePath<t.Expression>
        );
        path.stop();
      },
    });
    if (result) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────
// Mixed concatenation + template
// ─────────────────────────────────────────────────

describe('extractString — mixed', () => {
  it('coalesces "A" + `B ${"C"}`', () => {
    const { errors, value } = extractFromCode('"A" + `B ${"C"}`');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'AB C' });
  });

  it('handles concat with dynamic in template: "Hi " + `${name}!`', () => {
    const { errors, value } = extractFromCode('"Hi " + `${name}!`');
    expect(errors).toHaveLength(0);
    expect(staticParts(value!)).toContain('Hi ');
    expect(staticParts(value!)).toContain('!');
    expect(value!.some((p) => !isChoiceNode(p) && p.type === 'dynamic')).toBe(
      true
    );
  });
});

// ─────────────────────────────────────────────────
// Dynamic expressions
// ─────────────────────────────────────────────────

describe('extractString — dynamic', () => {
  it('returns dynamic part for identifier', () => {
    const { errors, value } = extractFromCode('name');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect((value![0] as { type: string }).type).toBe('dynamic');
  });

  it('returns dynamic part for function call', () => {
    const { errors, value } = extractFromCode('getName()');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect((value![0] as { type: string }).type).toBe('dynamic');
  });

  it('returns dynamic part for member expression', () => {
    const { errors, value } = extractFromCode('obj.name');
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect((value![0] as { type: string }).type).toBe('dynamic');
  });
});

// ─────────────────────────────────────────────────
// Derive expressions
// ─────────────────────────────────────────────────

describe('extractString — derive', () => {
  it('recognizes derive() as a derive part', () => {
    const code = `import { derive } from 'gt-react/browser';\nderive(fn())`;
    const { errors, value } = extractFromModule(code);
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect((value![0] as { type: string }).type).toBe('derive');
  });

  it('extracts derive alongside static content', () => {
    const code = `import { derive } from 'gt-react/browser';\n"Hello " + derive(fn())`;
    const { errors, value } = extractFromModule(code);
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(2);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello ' });
    expect((value![1] as { type: string }).type).toBe('derive');
  });

  it('extracts derive in template literal', () => {
    const code = `import { derive } from 'gt-react/browser';\n\`Hello \${derive(fn())}\``;
    const { errors, value } = extractFromModule(code);
    expect(errors).toHaveLength(0);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello ' });
    expect((value![1] as { type: string }).type).toBe('derive');
  });

  it('treats non-GT derive import as dynamic', () => {
    const code = `import { derive } from 'other-lib';\nderive(fn())`;
    const { errors, value } = extractFromModule(code);
    expect(errors).toHaveLength(0);
    expect(value).toHaveLength(1);
    expect((value![0] as { type: string }).type).toBe('dynamic');
  });
});

// ─────────────────────────────────────────────────
// Static coalescing
// ─────────────────────────────────────────────────

describe('extractString — coalescing', () => {
  it('coalesces all adjacent statics into one part', () => {
    const { value } = extractFromCode('"A" + "B" + "C" + "D"');
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'ABCD' });
  });

  it('does not coalesce across dynamic boundaries', () => {
    const { value } = extractFromCode('"A" + name + "B"');
    expect(value).toHaveLength(3);
    expect(value![0]).toEqual({ type: 'static', content: 'A' });
    expect((value![1] as { type: string }).type).toBe('dynamic');
    expect(value![2]).toEqual({ type: 'static', content: 'B' });
  });

  it('coalesces template quasis with adjacent static expressions', () => {
    const { value } = extractFromCode('`Hello ${"World"}!`');
    expect(value).toHaveLength(1);
    expect(value![0]).toEqual({ type: 'static', content: 'Hello World!' });
  });
});

// ─────────────────────────────────────────────────
// metadata.hasStatic
// ─────────────────────────────────────────────────

describe('extractString — hasStatic metadata', () => {
  it('sets hasStatic=true for a pure template literal with no expressions', () => {
    const { metadata } = extractFromCode('`hello`');
    expect(metadata.hasStatic).toBe(true);
  });

  it('sets hasStatic=true for a template literal with static quasis and dynamic expression', () => {
    const { metadata } = extractFromCode('`Hello ${name}`');
    expect(metadata.hasStatic).toBe(true);
  });

  it('sets hasStatic=false for a purely dynamic identifier', () => {
    const { metadata } = extractFromCode('name');
    expect(metadata.hasStatic).toBe(false);
  });
});

// ─────────────────────────────────────────────────
// derive=false contract: no ChoiceNodes in result
// ─────────────────────────────────────────────────

describe('extractString — derive=false contract', () => {
  it('never returns ChoiceNodes when derive=false', () => {
    const codes = [
      '"Hello"',
      '`template`',
      '"a" + "b"',
      '`Hello ${name}`',
      '"prefix" + name + "suffix"',
    ];
    for (const code of codes) {
      let result: ReturnType<typeof extractString> | undefined;
      withExpressionPath(code, (path) => {
        result = extractString(path, false);
      });
      if (result?.value) {
        for (const node of result.value) {
          expect(isChoiceNode(node)).toBe(false);
        }
      }
    }
  });
});
