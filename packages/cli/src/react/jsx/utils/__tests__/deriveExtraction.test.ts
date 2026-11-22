import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import {
  parseStringExpression,
  nodeToStrings,
} from '../../jsx/utils/parseString.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';

const traverse = (traverseModule as unknown).default || traverseModule;

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

type Case = [
  name: string,
  code: string,
  // The strings `__target__` resolves to, or null when it cannot be resolved
  expected: string[] | null,
  problem?: { error?: string; warning?: string; noErrors?: true },
];

/**
 * Registers one test per case. `error` / `warning` is a fragment of the first
 * reported error / warning.
 */
function cases(rows: Case[]) {
  it.each(rows)('%s', (_name, code, expected, problem = {}) => {
    const { node, errors, warnings } = parseAndResolve(code);

    if (expected === null) {
      expect(node).toBeNull();
    } else {
      expect(nodeToStrings(node)).toEqual(expected);
    }
    if (problem.error) {
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain(problem.error);
    }
    if (problem.warning) {
      expect(warnings.size).toBeGreaterThan(0);
      expect([...warnings][0]).toContain(problem.warning);
    }
    if (problem.noErrors) {
      expect(errors).toEqual([]);
    }
  });
}

// ─── Category 1: String Constants ────────────────────────────────────────────

describe('String Constants', () => {
  cases([
    [
      'resolves const string identifier',
      `const X = 'hello'; const __target__ = X;`,
      ['hello'],
    ],
    [
      'resolves const number identifier',
      'const X = 42; const __target__ = X;',
      ['42'],
    ],
    [
      'resolves const boolean identifier',
      'const X = true; const __target__ = X;',
      ['true'],
    ],
    [
      'resolves chained const references',
      `const A = 'hi'; const B = A; const __target__ = B;`,
      ['hi'],
    ],
    [
      'resolves const with conditional value',
      `const cond = true; const X = cond ? 'a' : 'b'; const __target__ = X;`,
      ['a', 'b'],
    ],
    [
      'resolves const in template literal',
      `const X = 'Hello'; const __target__ = \`\${X} world\`;`,
      ['Hello world'],
    ],
    [
      'resolves const concat with +',
      `const A = 'Hello'; const B = ' World'; const __target__ = A + B;`,
      ['Hello World'],
    ],
  ]);
});

// ─── Category 2: Const-Only Enforcement ──────────────────────────────────────

describe('Const-Only Enforcement', () => {
  cases([
    [
      'warns on let variable',
      `let X = 'hello'; const __target__ = X;`,
      null,
      { warning: "'let'" },
    ],
    [
      'warns on var variable',
      `var X = 'hello'; const __target__ = X;`,
      null,
      { warning: "'var'" },
    ],
  ]);
});

// ─── Category 3: Object Computed Access ──────────────────────────────────────

describe('Object Computed Access', () => {
  cases([
    [
      'extracts all values from obj[key]',
      `const O = { a: 'x', b: 'y' }; const key = 'a'; const __target__ = O[key];`,
      ['x', 'y'],
    ],
    [
      'handles numeric keys',
      `
      const O = { 0: 'Bad', 1: 'OK', 2: 'Good' };
      const score = 1;
      const __target__ = O[score];
    `,
      ['Bad', 'OK', 'Good'],
    ],
    [
      'handles many properties',
      `const O = { a: 'x', b: 'y', c: 'z', d: 'w' }; const k = 'a'; const __target__ = O[k];`,
      ['x', 'y', 'z', 'w'],
    ],
    [
      'handles conditional values in object',
      `
      const cond = true;
      const O = { a: cond ? 'x' : 'y', b: 'z' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['x', 'y', 'z'],
    ],
    [
      'handles object in template literal',
      `const O = { 0: 'Bad', 1: 'Good' }; const s = 0; const __target__ = \`Score: \${O[s]}\`;`,
      ['Score: Bad', 'Score: Good'],
    ],
  ]);
});

// ─── Category 4: Object Static Access ────────────────────────────────────────

describe('Object Static Access', () => {
  cases([
    [
      'resolves obj.prop',
      `const O = { greeting: 'Hello' }; const __target__ = O.greeting;`,
      ['Hello'],
    ],
    [
      'resolves specific property only',
      `const O = { a: 'x', b: 'y' }; const __target__ = O.a;`,
      ['x'],
    ],
    [
      'narrows to one value with string literal subscript',
      `const O = { good: 'yes', bad: 'no' }; const __target__ = O['good'];`,
      ['yes'],
    ],
    [
      'narrows to one value with numeric literal subscript',
      `const O = { 0: 'zero', 1: 'one', 2: 'two' }; const __target__ = O[0];`,
      ['zero'],
    ],
    // Can't resolve computed keys, so falls back to extracting all values
    [
      'falls back to all values when object has computed keys',
      `
      const g = 'good';
      const O = { [g]: 'yes', [g + '2']: 'no' };
      const __target__ = O['good'];
    `,
      ['yes', 'no'],
    ],
    // All keys are literals, so we can narrow
    [
      'narrows when all keys are literal despite static subscript',
      `const O = { good: 'yes', bad: 'no' }; const __target__ = O['good'];`,
      ['yes'],
    ],
  ]);
});

// ─── Category 4b: Array Access ────────────────────────────────────────────────

describe('Array Access', () => {
  cases([
    [
      'extracts all values from array[key]',
      `const A = ['yes', 'no', 'maybe']; const k = 0; const __target__ = A[k];`,
      ['yes', 'no', 'maybe'],
    ],
    [
      'narrows to one value with numeric literal subscript on array',
      `const A = ['zero', 'one', 'two']; const __target__ = A[0];`,
      ['zero'],
    ],
    [
      'handles array with conditional values',
      `
      const cond = true;
      const A = [cond ? 'a' : 'b', 'c'];
      const k = 0;
      const __target__ = A[k];
    `,
      ['a', 'b', 'c'],
    ],
    [
      'handles array in template literal',
      `const A = ['Bad', 'Good']; const s = 0; const __target__ = \`Score: \${A[s]}\`;`,
      ['Score: Bad', 'Score: Good'],
    ],
    [
      'warns on non-const array',
      `let A = ['x']; const k = 0; const __target__ = A[k];`,
      null,
      { warning: 'declared with' },
    ],
    [
      'returns null for empty array',
      'const A: string[] = []; const k = 0; const __target__ = A[k];',
      null,
    ],
    [
      'handles array as const',
      `const A = ['x', 'y'] as const; const k = 0; const __target__ = A[k];`,
      ['x', 'y'],
    ],
    [
      'errors on unresolvable array element',
      `const A = ['ok', ['nested']]; const k = 0; const __target__ = A[k];`,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'resolves array spread',
      `const base = ['a', 'b']; const A = [...base, 'c']; const k = 0; const __target__ = A[k];`,
      ['a', 'b', 'c'],
    ],
    [
      'resolves multiple array spreads',
      `
      const a = ['x'];
      const b = ['y'];
      const A = [...a, ...b, 'z'];
      const k = 0;
      const __target__ = A[k];
    `,
      ['x', 'y', 'z'],
    ],
    [
      'skips holes in sparse arrays',
      `const A = ['a', , 'c']; const k = 0; const __target__ = A[k];`,
      ['a', 'c'],
    ],
    [
      'resolves function call element in array',
      `
      function getVal() { return 'resolved'; }
      const A = [getVal(), 'static'];
      const k = 0;
      const __target__ = A[k];
    `,
      ['resolved', 'static'],
    ],
    [
      'resolves object nested in array with static access',
      `const A = [{ x: 'hi' }]; const __target__ = A[0].x;`,
      ['hi'],
    ],
    [
      'resolves object nested in array with dynamic access',
      `const A = [{ x: 'hi' }, { x: 'bye' }]; const k = 0; const __target__ = A[k].x;`,
      ['hi', 'bye'],
    ],
    [
      'resolves array nested in object',
      `const O = { items: ['a', 'b'] }; const k = 0; const __target__ = O.items[k];`,
      ['a', 'b'],
    ],
    [
      'resolves array nested in object with static subscript',
      `const O = { items: ['a', 'b', 'c'] }; const __target__ = O.items[1];`,
      ['b'],
    ],
  ]);
});

// ─── Category 4c: Array/Object Edge Cases ─────────────────────────────────────

describe('Array/Object Edge Cases', () => {
  cases([
    // Second element has no 'x' — should only get 'hi'
    [
      'skips missing key in array-of-objects access',
      `const A = [{ x: 'hi' }, { y: 'bye' }]; const k = 0; const __target__ = A[k].x;`,
      ['hi'],
    ],
    [
      'resolves nested spread (spread of spread)',
      `
      const a = ['x'];
      const b = [...a, 'y'];
      const C = [...b, 'z'];
      const k = 0;
      const __target__ = C[k];
    `,
      ['x', 'y', 'z'],
    ],
    [
      'handles as const on array elements',
      `const A = ['a' as const, 'b' as const]; const k = 0; const __target__ = A[k];`,
      ['a', 'b'],
    ],
    // Collects all matching keys (can't statically determine which "wins")
    [
      'handles duplicate keys in object — collects all',
      `const O = { a: 'first', a: 'second' }; const __target__ = O.a;`,
      ['first', 'second'],
    ],
    [
      'resolves deeply nested mixed array/object — 4 levels',
      `const D = { a: [{ b: ['deep'] }] }; const __target__ = D.a[0].b[0];`,
      ['deep'],
    ],
    // Static subscript narrows to index 0, which is a conditional
    [
      'narrows conditional element with static array subscript',
      `const cond = true; const A = [cond ? 'a' : 'b', 'c']; const __target__ = A[0];`,
      ['a', 'b'],
    ],
    [
      'handles empty spread source',
      `
      const empty: string[] = [];
      const A = [...empty, 'only'];
      const k = 0;
      const __target__ = A[k];
    `,
      ['only'],
    ],
    // let spread source should be skipped; only 'ok' collected
    [
      'rejects let spread source in const array',
      `let base = ['mutable']; const A = [...base, 'ok']; const k = 0; const __target__ = A[k];`,
      ['ok'],
    ],
    // Both spread and own 'items' collected, all array elements extracted
    [
      'handles object spread with array value override',
      `
      const base = { items: ['a'] };
      const O = { ...base, items: ['b', 'c'] };
      const k = 0;
      const __target__ = O.items[k];
    `,
      ['a', 'b', 'c'],
    ],
    [
      'handles satisfies operator on array',
      `const A = ['x', 'y'] satisfies string[]; const k = 0; const __target__ = A[k];`,
      ['x', 'y'],
    ],
    [
      'handles satisfies operator on object',
      `
      const O = { a: 'x', b: 'y' } satisfies Record<string, string>;
      const k = 'a';
      const __target__ = O[k];
    `,
      ['x', 'y'],
    ],
    // Computed keys can't be resolved, so fallback to extracting all values
    [
      'scans all values when object has computed keys with static subscript',
      `
      const a = 'good';
      const b = 'good' as string;
      const O = { [a]: 'yes', [b]: 'no' };
      const __target__ = O['good'];
    `,
      ['yes', 'no'],
    ],
  ]);
});

// ─── Category 4d: Adversarial Edge Cases ──────────────────────────────────────

describe('Adversarial Edge Cases', () => {
  cases([
    [
      'resolves shorthand property',
      `const x = 'val'; const O = { x }; const __target__ = O.x;`,
      ['val'],
    ],
    [
      'matches numeric key with string subscript',
      `const O = { 0: 'a', 1: 'b' }; const __target__ = O['0'];`,
      ['a'],
    ],
    [
      'matches string key with numeric subscript',
      `const O = { '0': 'a', '1': 'b' }; const __target__ = O[0];`,
      ['a'],
    ],
    [
      'errors on optional chaining',
      `const O = { a: 'x' }; const __target__ = O?.a;`,
      null,
      { error: 'Optional chaining' },
    ],
    [
      'errors on logical expression value',
      `
      const x = undefined;
      const O = { a: x || 'default', b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'unwraps non-null assertion on value',
      `const x = 'hello'; const O = { a: x!, b: 'ok' }; const k = 'a'; const __target__ = O[k];`,
      ['hello', 'ok'],
    ],
    [
      'resolves conditional object expression',
      `const cond = true; const O = cond ? { a: 'x' } : { a: 'y' }; const __target__ = O.a;`,
      ['x', 'y'],
    ],
    [
      'returns null for Object.freeze wrapped object',
      `const O = Object.freeze({ a: 'x' }); const __target__ = O.a;`,
      null,
    ],
    // Angle bracket assertions (<string>x) are invalid in .tsx files (conflicts with JSX).
    // No test needed — the `as` syntax covers the same unwrap path.
    [
      'falls back to all values for negative numeric key',
      `const O = { a: 'pos', [-1]: 'neg' }; const k = 'a'; const __target__ = O[k];`,
      ['pos', 'neg'],
    ],
  ]);
});

// ─── Category 4e: Adversarial Edge Cases Round 3 ──────────────────────────────

describe('Adversarial Edge Cases Round 3', () => {
  cases([
    [
      'resolves object value that is another object property access',
      `
      const labels = { greeting: 'Hello' };
      const O = { a: labels.greeting };
      const __target__ = O.a;
    `,
      ['Hello'],
    ],
    [
      'errors on destructured variable',
      `const { x } = { x: 'hello' }; const __target__ = x;`,
      null,
      { error: 'destructuring' },
    ],
    [
      'resolves nested conditional object expression',
      `
      const cond1 = true;
      const cond2 = false;
      const O = cond1 ? (cond2 ? { a: 'x' } : { a: 'y' }) : { a: 'z' };
      const __target__ = O.a;
    `,
      ['x', 'y', 'z'],
    ],
    [
      'resolves conditional with as const branches',
      `
      const cond = true;
      const O = cond ? { a: 'x' } as const : { a: 'y' } as const;
      const __target__ = O.a;
    `,
      ['x', 'y'],
    ],
    [
      'errors on array destructured variable',
      `const [first, second] = ['hello', 'world']; const __target__ = first;`,
      null,
      { error: 'destructuring' },
    ],
    [
      'resolves inline spread source',
      `const O = { ...({ base: 'val' }), a: 'x' }; const k = 'a'; const __target__ = O[k];`,
      ['val', 'x'],
    ],
    [
      'errors on enum member value',
      `
      enum Color { Red = 'red', Blue = 'blue' }
      const O = { a: Color.Red, b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'falls back to all values for template literal key',
      `
      const O = { [\`key\`]: 'computed', other: 'literal' };
      const k = 'other';
      const __target__ = O[k];
    `,
      ['computed', 'literal'],
    ],
    [
      'errors on nullish coalescing value',
      `
      const x = undefined;
      const O = { a: x ?? 'default', b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['ok'],
      { error: 'could not be resolved' },
    ],
  ]);

  it('errors on circular spread', () => {
    const { node, errors } = parseAndResolve(`
      const A = { ...B, x: '1' };
      const B = { ...A, y: '2' };
      const k = 'x';
      const __target__ = A[k];
    `);
    // Circular spread is detected and reported as an error
    expect(nodeToStrings(node)).toEqual(['1', '2']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Circular spread');
  }, 5000);
});

// ─── Category 4f: Adversarial Edge Cases Round 4 ──────────────────────────────

describe('Adversarial Edge Cases Round 4', () => {
  cases([
    [
      'resolves nested array access A[0][1]',
      `const A = [['a', 'b'], ['c', 'd']]; const __target__ = A[0][1];`,
      ['b'],
    ],
    [
      'resolves conditional array source',
      `
      const cond = true;
      const A = cond ? ['x', 'y'] : ['p', 'q'];
      const k = 0;
      const __target__ = A[k];
    `,
      ['x', 'y', 'p', 'q'],
    ],
    [
      'resolves empty string key',
      `const O = { '': 'empty', a: 'other' }; const __target__ = O[''];`,
      ['empty'],
    ],
    [
      'resolves unicode key',
      `const O = { '🎉': 'party', '🔥': 'fire' }; const __target__ = O['🎉'];`,
      ['party'],
    ],
    [
      'resolves inline nested spread',
      `
      const inner = { a: 'deep' };
      const O = { ...{ ...inner, b: 'mid' }, c: 'top' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['deep', 'mid', 'top'],
    ],
    // Both keys resolve to '0' — collects both since no break
    [
      'collects both entries for numeric/string key collision',
      `const O = { 0: 'numeric', '0': 'string' }; const __target__ = O[0];`,
      ['numeric', 'string'],
    ],
    // Dynamic key extracts all values; each ternary produces 2 branches
    [
      'extracts all branches from multiple ternary values',
      `
      const c1 = true;
      const c2 = false;
      const O = { a: c1 ? 'x' : 'y', b: c2 ? 'p' : 'q' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['x', 'y', 'p', 'q'],
    ],
    // .length is not a data property — should not resolve
    [
      'returns null for array .length access',
      `const A = ['a', 'b', 'c']; const __target__ = A.length;`,
      null,
    ],
    // let spread source should produce an error
    [
      'errors on let spread source in array',
      `
      let mutable = ['bad'];
      const A = ['ok', ...mutable];
      const k = 0;
      const __target__ = A[k];
    `,
      ['ok'],
      { error: 'declared with' },
    ],
    // Direct property access on an object literal is not supported: there is
    // no variable binding to resolve
    [
      'returns null for direct access on inline object expression',
      `const __target__ = ({ a: 'x', b: 'y' }).a;`,
      null,
    ],
  ]);
});

// ─── Category 4g: Adversarial Edge Cases Round 5 ──────────────────────────────

describe('Adversarial Edge Cases Round 5', () => {
  cases([
    // A points to B which is an object — should follow the chain
    [
      'resolves identifier chain to object',
      `const B = { a: 'x', b: 'y' }; const A = B; const __target__ = A.a;`,
      ['x'],
    ],
    // Nested ternary in value position — parseStringExpression handles conditionals
    [
      'resolves nested ternary as object VALUE',
      `
      const c1 = true;
      const c2 = false;
      const O = { a: c1 ? (c2 ? 'x' : 'y') : 'z' };
      const __target__ = O.a;
    `,
      ['x', 'y', 'z'],
    ],
    [
      'resolves string concat as object value',
      `const O = { a: 'hello' + ' world' }; const __target__ = O.a;`,
      ['hello world'],
    ],
    // Both spreads contribute 'x' — can't know which wins at static time
    [
      'collects both values from two spreads with same key',
      `
      const a = { x: 'first' };
      const b = { x: 'second' };
      const O = { ...a, ...b };
      const __target__ = O.x;
    `,
      ['first', 'second'],
    ],
    [
      'resolves spread of as-const object',
      `
      const base = { a: 'x' } as const;
      const O = { ...base, b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['x', 'y'],
    ],
    [
      'resolves numeric and boolean values in object',
      `const O = { a: 42, b: true }; const k = 'a'; const __target__ = O[k];`,
      ['42', 'true'],
    ],
    [
      'resolves 3-level nested conditional source',
      `
      const c1 = true;
      const c2 = false;
      const c3 = true;
      const O = c1 ? (c2 ? (c3 ? { a: '1' } : { a: '2' }) : { a: '3' }) : { a: '4' };
      const __target__ = O.a;
    `,
      ['1', '2', '3', '4'],
    ],
    [
      'resolves function call as object value',
      `
      function getLabel() { return 'resolved'; }
      const O = { a: getLabel(), b: 'static' };
      const __target__ = O.a;
    `,
      ['resolved'],
    ],
    [
      'unwraps satisfies on array element',
      `
      const A = ['a' satisfies string, 'b' satisfies string];
      const k = 0;
      const __target__ = A[k];
    `,
      ['a', 'b'],
    ],
    [
      'resolves template literal as object value',
      `
      const name = 'World';
      const O = { greeting: \`Hello \${name}\` };
      const __target__ = O.greeting;
    `,
      ['Hello World'],
    ],
  ]);
});

// ─── Category 5: Object Error Cases ──────────────────────────────────────────

describe('Object Error Cases', () => {
  cases([
    [
      'resolves chained computed access',
      `const O = { a: { x: 'hi' } }; const a = 'a'; const b = 'x'; const __target__ = O[a][b];`,
      ['hi'],
    ],
    [
      'warns on non-const object',
      `let O = { a: 'x' }; const k = 'a'; const __target__ = O[k];`,
      null,
      { warning: 'declared with' },
    ],
    [
      'returns null for empty object',
      `const O = {}; const k = 'a'; const __target__ = O[k];`,
      null,
    ],
  ]);
});

// ─── Category 6: as const ────────────────────────────────────────────────────

describe('as const', () => {
  cases([
    [
      'handles obj as const',
      `const O = { a: 'x', b: 'y' } as const; const k = 'a'; const __target__ = O[k];`,
      ['x', 'y'],
    ],
  ]);
});

// ─── Category 7: Edge Cases ──────────────────────────────────────────────────

describe('Edge Cases', () => {
  cases([
    [
      'resolves spread properties',
      `
      const base = { z: 'base' };
      const O = { ...base, a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['base', 'x'],
    ],
    [
      'skips method properties',
      `const O = { a: 'x', fn() {} }; const k = 'a'; const __target__ = O[k];`,
      ['x'],
    ],
    [
      'returns null for nonexistent property',
      `const O = { a: 'x' }; const __target__ = O.b;`,
      null,
    ],
    [
      'returns null for unresolvable identifier',
      'const __target__ = NONEXISTENT;',
      null,
    ],
  ]);
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
  cases([
    // Documents current behavior: const enforcement applies inside function bodies too
    [
      'rejects let variable inside function return',
      `function f() { let x = 'hi'; return x; } const __target__ = f();`,
      null,
      { warning: 'declared with' },
    ],
    [
      'rejects var variable inside function return',
      `function f() { var x = 'hi'; return x; } const __target__ = f();`,
      null,
      { warning: 'declared with' },
    ],
    [
      'resolves const variable inside function return',
      `function f() { const x = 'hi'; return x; } const __target__ = f();`,
      ['hi'],
    ],
    [
      'rejects let at top scope',
      `let x = 'hi'; const __target__ = x;`,
      null,
      { warning: 'declared with' },
    ],
  ]);
});

// ─── Category C: MemberExpression Edge Cases ──────────────────────────────────

describe('MemberExpression Edge Cases', () => {
  cases([
    // ArrayExpression is now supported — narrows to index 0
    [
      'resolves array access with static subscript',
      `const arr = ['a', 'b']; const __target__ = arr[0];`,
      ['a'],
    ],
    // Object value { inner: { deep: 'x' } } is not a string — parseStringExpression
    // will return null for it since ObjectExpression is not a handled literal type
    [
      'returns null for nested object value with computed access (no string leaf)',
      `const O = { a: { inner: { deep: 'x' } } }; const k = 'a'; const __target__ = O[k];`,
      null,
    ],
    // O[0] where 0 is a NumericLiteral — narrowed to key '0'
    [
      'narrows for literal numeric property access',
      `const O = { 0: 'x', 1: 'y' }; const __target__ = O[0];`,
      ['x'],
    ],
    // Getter is ObjectMethod, not ObjectProperty — should be skipped
    [
      'skips getter properties in computed access',
      `const O = { get a() { return 'x'; }, b: 'y' }; const k = 'a'; const __target__ = O[k];`,
      ['y'],
    ],
    // NewExpression init, not ObjectExpression
    [
      'returns null for member access on class instance',
      `class Foo { bar = 'x'; } const o = new Foo(); const __target__ = o.bar;`,
      null,
    ],
    // The call getVal() inside the object should be resolved recursively
    [
      'handles function call value inside object',
      `
      function getVal() { return 'resolved'; }
      const O = { a: getVal() };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['resolved'],
    ],
  ]);
});

// ─── Category C2: Non-Resolvable Object Value Errors ──────────────────────────

describe('Non-Resolvable Object Value Errors', () => {
  cases([
    // The 3 string values resolve; the array value should produce an error
    [
      'errors on array value in object (computed access)',
      `
      const LABELS = { 0: 'Bad', 1: 'OK', 2: 'Good', 3: ['yyoyoo'] };
      const score = 0;
      const __target__ = LABELS[score];
    `,
      ['Bad', 'OK', 'Good'],
      { error: 'could not be resolved' },
    ],
    [
      'errors on array value in object (static access)',
      `const O = { items: ['a', 'b', 'c'] }; const __target__ = O.items;`,
      null,
      { error: 'could not be resolved' },
    ],
    // 'ok' resolves, { nested: 'value' } does not
    [
      'errors on nested object value without further access',
      `const O = { a: 'ok', b: { nested: 'value' } }; const k = 'a'; const __target__ = O[k];`,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'errors when all values are non-resolvable',
      `const O = { a: ['x'], b: ['y'] }; const k = 'a'; const __target__ = O[k];`,
      null,
      { error: 'could not be resolved' },
    ],
    [
      'no error when all values resolve',
      `const O = { a: 'x', b: 'y' }; const k = 'a'; const __target__ = O[k];`,
      ['x', 'y'],
      { noErrors: true },
    ],
    // null is resolved as the string "null"
    [
      'resolves null value as string (no error)',
      `const O = { a: 'yes', b: null }; const k = 'a'; const __target__ = O[k];`,
      ['yes', 'null'],
      { noErrors: true },
    ],
    [
      'errors on undefined value in object',
      `const O = { a: 'yes', b: undefined }; const k = 'a'; const __target__ = O[k];`,
      ['yes'],
      { error: 'could not be resolved' },
    ],
    [
      'errors on new expression value in object',
      `const O = { a: 'ok', b: new Date() }; const k = 'a'; const __target__ = O[k];`,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'errors on arrow function value in object',
      `const O = { a: 'ok', b: () => 'hello' }; const k = 'a'; const __target__ = O[k];`,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'errors on unresolvable spread values',
      `
      const base = { x: [1, 2] };
      const O = { ...base, a: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['ok'],
      { error: 'could not be resolved' },
    ],
    [
      'errors on regex literal value in object',
      `const O = { a: 'ok', pattern: /hello/g }; const k = 'a'; const __target__ = O[k];`,
      ['ok'],
      { error: 'could not be resolved' },
    ],
  ]);
});

// ─── Category D: TSAsExpression Edge Cases ────────────────────────────────────

describe('TSAsExpression Edge Cases', () => {
  cases([
    [
      'unwraps as const on string identifier',
      `const X = 'hello' as const; const __target__ = X;`,
      ['hello'],
    ],
    [
      'unwraps as SomeType on string identifier',
      `const X = 'hello' as string; const __target__ = X;`,
      ['hello'],
    ],
    [
      'unwraps as const on object for static access',
      `const O = { a: 'x' } as const; const __target__ = O.a;`,
      ['x'],
    ],
    // Type annotations are now unwrapped at the top of parseStringExpression
    [
      'resolves nested as expressions',
      `const X = ('hello' as string) as const; const __target__ = X;`,
      ['hello'],
    ],
  ]);
});

// ─── Category E: Nested Object Access ─────────────────────────────────────────

describe('Nested Object Access', () => {
  cases([
    [
      'N1: static.static',
      `const O = { a: { x: 'hello' } }; const __target__ = O.a.x;`,
      ['hello'],
    ],
    [
      'N2: static.computed',
      `const O = { a: { x: 'p', y: 'q' } }; const k = 'x'; const __target__ = O.a[k];`,
      ['p', 'q'],
    ],
    [
      'N3: computed.static',
      `const O = { a: { x: 'p' }, b: { x: 'q' } }; const k = 'a'; const __target__ = O[k].x;`,
      ['p', 'q'],
    ],
    [
      'N4: computed.computed',
      `
      const O = { a: { x: '1', y: '2' }, b: { x: '3', y: '4' } };
      const k1 = 'a';
      const k2 = 'x';
      const __target__ = O[k1][k2];
    `,
      ['1', '2', '3', '4'],
    ],
    [
      'N5: static narrows',
      `
      const O = { good: { x: 'yes' }, bad: { x: 'no' } };
      const k = 'x';
      const __target__ = O.good[k];
    `,
      ['yes'],
    ],
    [
      'N6: numeric keys nested',
      `
      const O = { 0: { label: 'Bad' }, 1: { label: 'Good' } };
      const s = 0;
      const __target__ = O[s].label;
    `,
      ['Bad', 'Good'],
    ],
    [
      'N7: mixed 3-deep static',
      `const O = { a: { b: { c: 'deep' } } }; const __target__ = O.a.b.c;`,
      ['deep'],
    ],
    [
      'N8: as const nested',
      `const O = { a: { x: 'p' } } as const; const __target__ = O.a.x;`,
      ['p'],
    ],
  ]);
});

// ─── Category F: Spread Resolution ────────────────────────────────────────────

describe('Spread Resolution', () => {
  cases([
    [
      'S1: spread const obj',
      `
      const base = { a: 'x' };
      const O = { ...base, b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['x', 'y'],
    ],
    // Both "old" (from spread) and "new" (own prop) — can't know runtime key
    [
      'S2: spread overwrites — extracts all since key is dynamic',
      `
      const base = { a: 'old' };
      const O = { ...base, a: 'new' };
      const k = 'a';
      const __target__ = O[k];
    `,
      ['old', 'new'],
    ],
    [
      'S3: spread static access',
      `const base = { greeting: 'Hi' }; const O = { ...base }; const __target__ = O.greeting;`,
      ['Hi'],
    ],
    [
      'S4: multiple spreads',
      `
      const a = { x: '1' };
      const b = { y: '2' };
      const O = { ...a, ...b, z: '3' };
      const k = 'x';
      const __target__ = O[k];
    `,
      ['1', '2', '3'],
    ],
    // Skip unresolvable spread, extract what we can
    [
      'S5: spread non-resolvable',
      `const O = { ...unknownVar, a: 'x' }; const k = 'a'; const __target__ = O[k];`,
      ['x'],
    ],
    [
      'S6: spread nested obj',
      `const base = { a: { x: 'inner' } }; const O = { ...base }; const __target__ = O.a.x;`,
      ['inner'],
    ],
  ]);
});

// ─── Category G: False-Positive Guards ────────────────────────────────────────

describe('False-Positive Guards', () => {
  cases([
    [
      'F1: static path excludes siblings',
      `const O = { a: { x: 'yes' }, b: { x: 'no' } }; const __target__ = O.a.x;`,
      ['yes'],
    ],
    [
      'F2: static outer, computed inner excludes other branches',
      `
      const O = { good: { x: 'p', y: 'q' }, bad: { x: 'r', y: 's' } };
      const k = 'x';
      const __target__ = O.good[k];
    `,
      ['p', 'q'],
    ],
    [
      'F3: static narrows at every level',
      `
      const O = { a: { b: { target: 'hit' }, c: { target: 'miss' } } };
      const __target__ = O.a.b.target;
    `,
      ['hit'],
    ],
    [
      'F4: computed then static only gets matching prop',
      `
      const O = { x: { label: 'A', desc: 'AA' }, y: { label: 'B', desc: 'BB' } };
      const k = 'x';
      const __target__ = O[k].label;
    `,
      ['A', 'B'],
    ],
    [
      'F5: mix of value types — only strings extracted',
      `
      const O = { a: { text: 'hello', count: 42, nested: { x: 'nope' } } };
      const __target__ = O.a.text;
    `,
      ['hello'],
    ],
    [
      'F6: sibling at same depth ignored',
      `
      const O = { target: { msg: 'yes' }, decoy: { msg: 'no' } };
      const __target__ = O.target.msg;
    `,
      ['yes'],
    ],
  ]);
});

// ─── Category H: Nested Error / Edge Cases ────────────────────────────────────

describe('Nested Error / Edge Cases', () => {
  cases([
    [
      'E1: non-object nested value',
      `const O = { a: 'string' }; const __target__ = O.a.x;`,
      null,
    ],
    [
      'E2: nested empty inner',
      `const O = { a: {} }; const k = 'x'; const __target__ = O.a[k];`,
      null,
    ],
    [
      'E3: static access on non-existent nested prop',
      `const O = { a: { x: 'hi' } }; const __target__ = O.a.missing;`,
      null,
    ],
  ]);
});
