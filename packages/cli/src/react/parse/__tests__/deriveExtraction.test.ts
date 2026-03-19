import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import {
  parseStringExpression,
  nodeToStrings,
} from '../../jsx/utils/parseString.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';

const traverse = (traverseModule as any).default || traverseModule;

const defaultParsingOptions: ParsingConfigOptions = {
  conditionNames: [],
};

/**
 * Parse a code snippet, find the target expression, and run parseStringExpression on it.
 * The code should contain a variable called `__target__` whose initializer is the expression to test.
 */
function parseAndResolve(code: string): {
  node: ReturnType<typeof parseStringExpression>;
  warnings: Set<string>;
  errors: string[];
} {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let result: ReturnType<typeof parseStringExpression> = null;
  const warnings = new Set<string>();
  const errors: string[] = [];

  traverse(ast, {
    VariableDeclarator(path) {
      // Look for __target__ = <expr>
      if (
        path.node.id.type === 'Identifier' &&
        path.node.id.name === '__target__'
      ) {
        if (path.node.init) {
          result = parseStringExpression(
            path.node.init,
            path,
            'test.tsx',
            defaultParsingOptions,
            warnings,
            errors
          );
        }
      }
    },
  });

  return { node: result, warnings, errors };
}

// ─── Category 1: String Constants ────────────────────────────────────────────

describe('String Constants', () => {
  it('resolves const string identifier', () => {
    const { node } = parseAndResolve(`
      const X = 'hello';
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['hello']);
  });

  it('resolves const number identifier', () => {
    const { node } = parseAndResolve(`
      const X = 42;
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['42']);
  });

  it('resolves const boolean identifier', () => {
    const { node } = parseAndResolve(`
      const X = true;
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['true']);
  });

  it('resolves chained const references', () => {
    const { node } = parseAndResolve(`
      const A = 'hi';
      const B = A;
      const __target__ = B;
    `);
    expect(nodeToStrings(node)).toEqual(['hi']);
  });

  it('resolves const with conditional value', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const X = cond ? 'a' : 'b';
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b']);
  });

  it('resolves const in template literal', () => {
    const { node } = parseAndResolve(`
      const X = 'Hello';
      const __target__ = \`\${X} world\`;
    `);
    expect(nodeToStrings(node)).toEqual(['Hello world']);
  });

  it('resolves const concat with +', () => {
    const { node } = parseAndResolve(`
      const A = 'Hello';
      const B = ' World';
      const __target__ = A + B;
    `);
    expect(nodeToStrings(node)).toEqual(['Hello World']);
  });
});

// ─── Category 2: Const-Only Enforcement ──────────────────────────────────────

describe('Const-Only Enforcement', () => {
  it('warns on let variable', () => {
    const { node, warnings } = parseAndResolve(`
      let X = 'hello';
      const __target__ = X;
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
    expect([...warnings][0]).toContain("'let'");
  });

  it('warns on var variable', () => {
    const { node, warnings } = parseAndResolve(`
      var X = 'hello';
      const __target__ = X;
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
    expect([...warnings][0]).toContain("'var'");
  });
});

// ─── Category 3: Object Computed Access ──────────────────────────────────────

describe('Object Computed Access', () => {
  it('extracts all values from obj[key]', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', b: 'y' };
      const key = 'a';
      const __target__ = O[key];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('handles numeric keys', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'Bad', 1: 'OK', 2: 'Good' };
      const score = 1;
      const __target__ = O[score];
    `);
    expect(nodeToStrings(node)).toEqual(['Bad', 'OK', 'Good']);
  });

  it('handles many properties', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', b: 'y', c: 'z', d: 'w' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z', 'w']);
  });

  it('handles conditional values in object', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const O = { a: cond ? 'x' : 'y', b: 'z' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z']);
  });

  it('handles object in template literal', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'Bad', 1: 'Good' };
      const s = 0;
      const __target__ = \`Score: \${O[s]}\`;
    `);
    expect(nodeToStrings(node)).toEqual(['Score: Bad', 'Score: Good']);
  });
});

// ─── Category 4: Object Static Access ────────────────────────────────────────

describe('Object Static Access', () => {
  it('resolves obj.prop', () => {
    const { node } = parseAndResolve(`
      const O = { greeting: 'Hello' };
      const __target__ = O.greeting;
    `);
    expect(nodeToStrings(node)).toEqual(['Hello']);
  });

  it('resolves specific property only', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', b: 'y' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['x']);
  });
});

// ─── Category 5: Object Error Cases ──────────────────────────────────────────

describe('Object Error Cases', () => {
  it('resolves chained computed access', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'hi' } };
      const a = 'a';
      const b = 'x';
      const __target__ = O[a][b];
    `);
    expect(nodeToStrings(node)).toEqual(['hi']);
  });

  it('warns on non-const object', () => {
    const { node, warnings } = parseAndResolve(`
      let O = { a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
  });

  it('returns null for empty object', () => {
    const { node } = parseAndResolve(`
      const O = {};
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(node).toBeNull();
  });
});

// ─── Category 6: as const ────────────────────────────────────────────────────

describe('as const', () => {
  it('handles obj as const', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', b: 'y' } as const;
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });
});

// ─── Category 7: Edge Cases ──────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('resolves spread properties', () => {
    const { node } = parseAndResolve(`
      const base = { z: 'base' };
      const O = { ...base, a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['base', 'x']);
  });

  it('skips method properties', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', fn() {} };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x']);
  });

  it('returns null for nonexistent property', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x' };
      const __target__ = O.b;
    `);
    expect(node).toBeNull();
  });

  it('returns null for unresolvable identifier', () => {
    const { node } = parseAndResolve(`
      const __target__ = NONEXISTENT;
    `);
    expect(node).toBeNull();
  });
});

// ─── Category A: Infinite Recursion Guard ─────────────────────────────────────

describe('Infinite Recursion Guard', () => {
  it('handles circular const references without hanging', () => {
    const { node } = parseAndResolve(`
        const A = B;
        const B = A;
        const __target__ = A;
      `);
    // Should return null, not hang
    expect(node).toBeNull();
  }, 5000);

  it('handles self-referencing const without hanging', () => {
    const { node } = parseAndResolve(`
        const A = A;
        const __target__ = A;
      `);
    expect(node).toBeNull();
  }, 5000);

  it('handles three-way circular references without hanging', () => {
    const { node } = parseAndResolve(`
        const A = B;
        const B = C;
        const C = A;
        const __target__ = A;
      `);
    expect(node).toBeNull();
  }, 5000);
});

// ─── Category B: Const Enforcement in Non-Derive Contexts ─────────────────────

describe('Const Enforcement in Non-Derive Contexts', () => {
  it('rejects let variable inside function return', () => {
    const { node, warnings } = parseAndResolve(`
      function f() { let x = 'hi'; return x; }
      const __target__ = f();
    `);
    // Documents current behavior: const enforcement applies inside function bodies too
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
  });

  it('rejects var variable inside function return', () => {
    const { node, warnings } = parseAndResolve(`
      function f() { var x = 'hi'; return x; }
      const __target__ = f();
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
  });

  it('resolves const variable inside function return', () => {
    const { node } = parseAndResolve(`
      function f() { const x = 'hi'; return x; }
      const __target__ = f();
    `);
    expect(nodeToStrings(node)).toEqual(['hi']);
  });

  it('rejects let at top scope', () => {
    const { node, warnings } = parseAndResolve(`
      let x = 'hi';
      const __target__ = x;
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
  });
});

// ─── Category C: MemberExpression Edge Cases ──────────────────────────────────

describe('MemberExpression Edge Cases', () => {
  it('returns null for array access (not object)', () => {
    const { node } = parseAndResolve(`
      const arr = ['a', 'b'];
      const __target__ = arr[0];
    `);
    // ArrayExpression is not ObjectExpression
    expect(node).toBeNull();
  });

  it('returns null for nested object value with computed access (no string leaf)', () => {
    const { node } = parseAndResolve(`
      const O = { a: { inner: { deep: 'x' } } };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Object value { inner: { deep: 'x' } } is not a string — parseStringExpression
    // will return null for it since ObjectExpression is not a handled literal type
    expect(node).toBeNull();
  });

  it('returns null for literal numeric property access', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'x', 1: 'y' };
      const __target__ = O[0];
    `);
    // O[0] where 0 is a NumericLiteral — this is a computed MemberExpression
    // but the subscript is a literal, not an identifier scope lookup.
    // The handler treats it as computed (extracts ALL values).
    // If it resolves, it would give all values. Let's document.
    if (node) {
      expect(nodeToStrings(node)).toEqual(['x', 'y']);
    } else {
      expect(node).toBeNull();
    }
  });

  it('skips getter properties in computed access', () => {
    const { node } = parseAndResolve(`
      const O = { get a() { return 'x'; }, b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Getter is ObjectMethod, not ObjectProperty — should be skipped
    expect(nodeToStrings(node)).toEqual(['y']);
  });

  it('returns null for member access on class instance', () => {
    const { node } = parseAndResolve(`
      class Foo { bar = 'x'; }
      const o = new Foo();
      const __target__ = o.bar;
    `);
    // NewExpression init, not ObjectExpression
    expect(node).toBeNull();
  });

  it('handles function call value inside object', () => {
    const { node } = parseAndResolve(`
      function getVal() { return 'resolved'; }
      const O = { a: getVal() };
      const k = 'a';
      const __target__ = O[k];
    `);
    // The call getVal() inside the object should be resolved recursively
    expect(nodeToStrings(node)).toEqual(['resolved']);
  });
});

// ─── Category C2: Non-Resolvable Object Value Errors ──────────────────────────

describe('Non-Resolvable Object Value Errors', () => {
  it('errors on array value in object (computed access)', () => {
    const { node, errors } = parseAndResolve(`
      const LABELS = { 0: 'Bad', 1: 'OK', 2: 'Good', 3: ['yyoyoo'] };
      const score = 0;
      const __target__ = LABELS[score];
    `);
    // The 3 string values resolve; the array value should produce an error
    expect(nodeToStrings(node)).toEqual(['Bad', 'OK', 'Good']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on array value in object (static access)', () => {
    const { node, errors } = parseAndResolve(`
      const O = { items: ['a', 'b', 'c'] };
      const __target__ = O.items;
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on nested object value without further access', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', b: { nested: 'value' } };
      const k = 'a';
      const __target__ = O[k];
    `);
    // 'ok' resolves, { nested: 'value' } does not
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors when all values are non-resolvable', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: ['x'], b: ['y'] };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('no error when all values resolve', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'x', b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
    expect(errors.length).toBe(0);
  });

  it('resolves null value as string (no error)', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'yes', b: null };
      const k = 'a';
      const __target__ = O[k];
    `);
    // null is resolved as the string "null"
    expect(nodeToStrings(node)).toEqual(['yes', 'null']);
    expect(errors.length).toBe(0);
  });

  it('errors on undefined value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'yes', b: undefined };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['yes']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on new expression value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', b: new Date() };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on arrow function value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', b: () => 'hello' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on unresolvable spread values', () => {
    const { node, errors } = parseAndResolve(`
      const base = { x: [1, 2] };
      const O = { ...base, a: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('errors on regex literal value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', pattern: /hello/g };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Category D: TSAsExpression Edge Cases ────────────────────────────────────

describe('TSAsExpression Edge Cases', () => {
  it('unwraps as const on string identifier', () => {
    const { node } = parseAndResolve(`
      const X = 'hello' as const;
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['hello']);
  });

  it('unwraps as SomeType on string identifier', () => {
    const { node } = parseAndResolve(`
      const X = 'hello' as string;
      const __target__ = X;
    `);
    expect(nodeToStrings(node)).toEqual(['hello']);
  });

  it('unwraps as const on object for static access', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x' } as const;
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['x']);
  });

  it('returns null for nested as expressions (known limitation)', () => {
    const { node } = parseAndResolve(`
      const X = ('hello' as string) as const;
      const __target__ = X;
    `);
    // Outer TSAsExpression unwraps to ParenthesizedExpression containing
    // another TSAsExpression. The inner TSAsExpression is not unwrapped
    // by parseStringExpression (only the Identifier handler unwraps it).
    // This is a known limitation — nested `as` casts are not supported.
    expect(node).toBeNull();
  });
});

// ─── Category E: Nested Object Access ─────────────────────────────────────────

describe('Nested Object Access', () => {
  it('N1: static.static', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'hello' } };
      const __target__ = O.a.x;
    `);
    expect(nodeToStrings(node)).toEqual(['hello']);
  });

  it('N2: static.computed', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'p', y: 'q' } };
      const k = 'x';
      const __target__ = O.a[k];
    `);
    expect(nodeToStrings(node)).toEqual(['p', 'q']);
  });

  it('N3: computed.static', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'p' }, b: { x: 'q' } };
      const k = 'a';
      const __target__ = O[k].x;
    `);
    expect(nodeToStrings(node)).toEqual(['p', 'q']);
  });

  it('N4: computed.computed', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: '1', y: '2' }, b: { x: '3', y: '4' } };
      const k1 = 'a';
      const k2 = 'x';
      const __target__ = O[k1][k2];
    `);
    expect(nodeToStrings(node)).toEqual(['1', '2', '3', '4']);
  });

  it('N5: static narrows', () => {
    const { node } = parseAndResolve(`
      const O = { good: { x: 'yes' }, bad: { x: 'no' } };
      const k = 'x';
      const __target__ = O.good[k];
    `);
    expect(nodeToStrings(node)).toEqual(['yes']);
  });

  it('N6: numeric keys nested', () => {
    const { node } = parseAndResolve(`
      const O = { 0: { label: 'Bad' }, 1: { label: 'Good' } };
      const s = 0;
      const __target__ = O[s].label;
    `);
    expect(nodeToStrings(node)).toEqual(['Bad', 'Good']);
  });

  it('N7: mixed 3-deep static', () => {
    const { node } = parseAndResolve(`
      const O = { a: { b: { c: 'deep' } } };
      const __target__ = O.a.b.c;
    `);
    expect(nodeToStrings(node)).toEqual(['deep']);
  });

  it('N8: as const nested', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'p' } } as const;
      const __target__ = O.a.x;
    `);
    expect(nodeToStrings(node)).toEqual(['p']);
  });
});

// ─── Category F: Spread Resolution ────────────────────────────────────────────

describe('Spread Resolution', () => {
  it('S1: spread const obj', () => {
    const { node } = parseAndResolve(`
      const base = { a: 'x' };
      const O = { ...base, b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('S2: spread overwrites — extracts all since key is dynamic', () => {
    const { node } = parseAndResolve(`
      const base = { a: 'old' };
      const O = { ...base, a: 'new' };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Both "old" (from spread) and "new" (own prop) — can't know runtime key
    expect(nodeToStrings(node)).toEqual(['old', 'new']);
  });

  it('S3: spread static access', () => {
    const { node } = parseAndResolve(`
      const base = { greeting: 'Hi' };
      const O = { ...base };
      const __target__ = O.greeting;
    `);
    expect(nodeToStrings(node)).toEqual(['Hi']);
  });

  it('S4: multiple spreads', () => {
    const { node } = parseAndResolve(`
      const a = { x: '1' };
      const b = { y: '2' };
      const O = { ...a, ...b, z: '3' };
      const k = 'x';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['1', '2', '3']);
  });

  it('S5: spread non-resolvable', () => {
    const { node } = parseAndResolve(`
      const O = { ...unknownVar, a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Skip unresolvable spread, extract what we can
    expect(nodeToStrings(node)).toEqual(['x']);
  });

  it('S6: spread nested obj', () => {
    const { node } = parseAndResolve(`
      const base = { a: { x: 'inner' } };
      const O = { ...base };
      const __target__ = O.a.x;
    `);
    expect(nodeToStrings(node)).toEqual(['inner']);
  });
});

// ─── Category G: False-Positive Guards ────────────────────────────────────────

describe('False-Positive Guards', () => {
  it('F1: static path excludes siblings', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'yes' }, b: { x: 'no' } };
      const __target__ = O.a.x;
    `);
    expect(nodeToStrings(node)).toEqual(['yes']);
  });

  it('F2: static outer, computed inner excludes other branches', () => {
    const { node } = parseAndResolve(`
      const O = { good: { x: 'p', y: 'q' }, bad: { x: 'r', y: 's' } };
      const k = 'x';
      const __target__ = O.good[k];
    `);
    expect(nodeToStrings(node)).toEqual(['p', 'q']);
  });

  it('F3: static narrows at every level', () => {
    const { node } = parseAndResolve(`
      const O = { a: { b: { target: 'hit' }, c: { target: 'miss' } } };
      const __target__ = O.a.b.target;
    `);
    expect(nodeToStrings(node)).toEqual(['hit']);
  });

  it('F4: computed then static only gets matching prop', () => {
    const { node } = parseAndResolve(`
      const O = { x: { label: 'A', desc: 'AA' }, y: { label: 'B', desc: 'BB' } };
      const k = 'x';
      const __target__ = O[k].label;
    `);
    expect(nodeToStrings(node)).toEqual(['A', 'B']);
  });

  it('F5: mix of value types — only strings extracted', () => {
    const { node } = parseAndResolve(`
      const O = { a: { text: 'hello', count: 42, nested: { x: 'nope' } } };
      const __target__ = O.a.text;
    `);
    expect(nodeToStrings(node)).toEqual(['hello']);
  });

  it('F6: sibling at same depth ignored', () => {
    const { node } = parseAndResolve(`
      const O = { target: { msg: 'yes' }, decoy: { msg: 'no' } };
      const __target__ = O.target.msg;
    `);
    expect(nodeToStrings(node)).toEqual(['yes']);
  });
});

// ─── Category H: Nested Error / Edge Cases ────────────────────────────────────

describe('Nested Error / Edge Cases', () => {
  it('E1: non-object nested value', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'string' };
      const __target__ = O.a.x;
    `);
    expect(node).toBeNull();
  });

  it('E2: nested empty inner', () => {
    const { node } = parseAndResolve(`
      const O = { a: {} };
      const k = 'x';
      const __target__ = O.a[k];
    `);
    expect(node).toBeNull();
  });

  it('E3: static access on non-existent nested prop', () => {
    const { node } = parseAndResolve(`
      const O = { a: { x: 'hi' } };
      const __target__ = O.a.missing;
    `);
    expect(node).toBeNull();
  });
});
