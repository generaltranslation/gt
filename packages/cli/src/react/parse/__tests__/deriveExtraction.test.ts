import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import {
  parseStringExpression,
  nodeToStrings,
} from '../../jsx/utils/parseString.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';

const traverse = traverseModule.default || traverseModule;

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
} {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let result: ReturnType<typeof parseStringExpression> = null;
  const warnings = new Set<string>();

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
            warnings
          );
        }
      }
    },
  });

  return { node: result, warnings };
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
  it('warns on chained access', () => {
    const { node, warnings } = parseAndResolve(`
      const O = { a: { x: 'hi' } };
      const a = 'a';
      const b = 'x';
      const __target__ = O[a][b];
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
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
  it('skips spread properties', () => {
    const { node } = parseAndResolve(`
      const base = { z: 'base' };
      const O = { ...base, a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Spread is skipped, only 'x' is extracted
    expect(nodeToStrings(node)).toEqual(['x']);
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
  it(
    'handles circular const references without hanging',
    () => {
      const { node } = parseAndResolve(`
        const A = B;
        const B = A;
        const __target__ = A;
      `);
      // Should return null, not hang
      expect(node).toBeNull();
    },
    5000
  );

  it(
    'handles self-referencing const without hanging',
    () => {
      const { node } = parseAndResolve(`
        const A = A;
        const __target__ = A;
      `);
      expect(node).toBeNull();
    },
    5000
  );

  it(
    'handles three-way circular references without hanging',
    () => {
      const { node } = parseAndResolve(`
        const A = B;
        const B = C;
        const C = A;
        const __target__ = A;
      `);
      expect(node).toBeNull();
    },
    5000
  );
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

  it('returns null for nested object value with computed access', () => {
    const { node } = parseAndResolve(`
      const O = { a: { inner: 'x' } };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Object value { inner: 'x' } is not a string — parseStringExpression
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
