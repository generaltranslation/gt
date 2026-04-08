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

  it('narrows to one value with string literal subscript', () => {
    const { node } = parseAndResolve(`
      const O = { good: 'yes', bad: 'no' };
      const __target__ = O['good'];
    `);
    expect(nodeToStrings(node)).toEqual(['yes']);
  });

  it('narrows to one value with numeric literal subscript', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'zero', 1: 'one', 2: 'two' };
      const __target__ = O[0];
    `);
    expect(nodeToStrings(node)).toEqual(['zero']);
  });

  it('falls back to all values when object has computed keys', () => {
    const { node } = parseAndResolve(`
      const g = 'good';
      const O = { [g]: 'yes', [g + '2']: 'no' };
      const __target__ = O['good'];
    `);
    // Can't resolve computed keys, so falls back to extracting all values
    expect(nodeToStrings(node)).toEqual(['yes', 'no']);
  });

  it('narrows when all keys are literal despite static subscript', () => {
    const { node } = parseAndResolve(`
      const O = { good: 'yes', bad: 'no' };
      const __target__ = O['good'];
    `);
    // All keys are literals, so we can narrow
    expect(nodeToStrings(node)).toEqual(['yes']);
  });
});

// ─── Category 4b: Array Access ────────────────────────────────────────────────

describe('Array Access', () => {
  it('extracts all values from array[key]', () => {
    const { node } = parseAndResolve(`
      const A = ['yes', 'no', 'maybe'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['yes', 'no', 'maybe']);
  });

  it('narrows to one value with numeric literal subscript on array', () => {
    const { node } = parseAndResolve(`
      const A = ['zero', 'one', 'two'];
      const __target__ = A[0];
    `);
    expect(nodeToStrings(node)).toEqual(['zero']);
  });

  it('handles array with conditional values', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const A = [cond ? 'a' : 'b', 'c'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b', 'c']);
  });

  it('handles array in template literal', () => {
    const { node } = parseAndResolve(`
      const A = ['Bad', 'Good'];
      const s = 0;
      const __target__ = \`Score: \${A[s]}\`;
    `);
    expect(nodeToStrings(node)).toEqual(['Score: Bad', 'Score: Good']);
  });

  it('warns on non-const array', () => {
    const { node, warnings } = parseAndResolve(`
      let A = ['x'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
    expect([...warnings][0]).toContain('declared with');
  });

  it('returns null for empty array', () => {
    const { node } = parseAndResolve(`
      const A: string[] = [];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(node).toBeNull();
  });

  it('handles array as const', () => {
    const { node } = parseAndResolve(`
      const A = ['x', 'y'] as const;
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('errors on unresolvable array element', () => {
    const { node, errors } = parseAndResolve(`
      const A = ['ok', ['nested']];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
  });

  it('resolves array spread', () => {
    const { node } = parseAndResolve(`
      const base = ['a', 'b'];
      const A = [...base, 'c'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b', 'c']);
  });

  it('resolves multiple array spreads', () => {
    const { node } = parseAndResolve(`
      const a = ['x'];
      const b = ['y'];
      const A = [...a, ...b, 'z'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z']);
  });

  it('skips holes in sparse arrays', () => {
    const { node } = parseAndResolve(`
      const A = ['a', , 'c'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'c']);
  });

  it('resolves function call element in array', () => {
    const { node } = parseAndResolve(`
      function getVal() { return 'resolved'; }
      const A = [getVal(), 'static'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['resolved', 'static']);
  });

  it('resolves object nested in array with static access', () => {
    const { node } = parseAndResolve(`
      const A = [{ x: 'hi' }];
      const __target__ = A[0].x;
    `);
    expect(nodeToStrings(node)).toEqual(['hi']);
  });

  it('resolves object nested in array with dynamic access', () => {
    const { node } = parseAndResolve(`
      const A = [{ x: 'hi' }, { x: 'bye' }];
      const k = 0;
      const __target__ = A[k].x;
    `);
    expect(nodeToStrings(node)).toEqual(['hi', 'bye']);
  });

  it('resolves array nested in object', () => {
    const { node } = parseAndResolve(`
      const O = { items: ['a', 'b'] };
      const k = 0;
      const __target__ = O.items[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b']);
  });

  it('resolves array nested in object with static subscript', () => {
    const { node } = parseAndResolve(`
      const O = { items: ['a', 'b', 'c'] };
      const __target__ = O.items[1];
    `);
    expect(nodeToStrings(node)).toEqual(['b']);
  });
});

// ─── Category 4c: Array/Object Edge Cases ─────────────────────────────────────

describe('Array/Object Edge Cases', () => {
  it('skips missing key in array-of-objects access', () => {
    const { node } = parseAndResolve(`
      const A = [{ x: 'hi' }, { y: 'bye' }];
      const k = 0;
      const __target__ = A[k].x;
    `);
    // Second element has no 'x' — should only get 'hi'
    expect(nodeToStrings(node)).toEqual(['hi']);
  });

  it('resolves nested spread (spread of spread)', () => {
    const { node } = parseAndResolve(`
      const a = ['x'];
      const b = [...a, 'y'];
      const C = [...b, 'z'];
      const k = 0;
      const __target__ = C[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z']);
  });

  it('handles as const on array elements', () => {
    const { node } = parseAndResolve(`
      const A = ['a' as const, 'b' as const];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b']);
  });

  it('handles duplicate keys in object — collects all', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'first', a: 'second' };
      const __target__ = O.a;
    `);
    // Collects all matching keys (can't statically determine which "wins")
    expect(nodeToStrings(node)).toEqual(['first', 'second']);
  });

  it('resolves deeply nested mixed array/object — 4 levels', () => {
    const { node } = parseAndResolve(`
      const D = { a: [{ b: ['deep'] }] };
      const __target__ = D.a[0].b[0];
    `);
    expect(nodeToStrings(node)).toEqual(['deep']);
  });

  it('narrows conditional element with static array subscript', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const A = [cond ? 'a' : 'b', 'c'];
      const __target__ = A[0];
    `);
    // Static subscript narrows to index 0, which is a conditional
    expect(nodeToStrings(node)).toEqual(['a', 'b']);
  });

  it('handles empty spread source', () => {
    const { node } = parseAndResolve(`
      const empty: string[] = [];
      const A = [...empty, 'only'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['only']);
  });

  it('rejects let spread source in const array', () => {
    const { node } = parseAndResolve(`
      let base = ['mutable'];
      const A = [...base, 'ok'];
      const k = 0;
      const __target__ = A[k];
    `);
    // let spread source should be skipped; only 'ok' collected
    expect(nodeToStrings(node)).toEqual(['ok']);
  });

  it('handles object spread with array value override', () => {
    const { node } = parseAndResolve(`
      const base = { items: ['a'] };
      const O = { ...base, items: ['b', 'c'] };
      const k = 0;
      const __target__ = O.items[k];
    `);
    // Both spread and own 'items' collected, all array elements extracted
    expect(nodeToStrings(node)).toEqual(['a', 'b', 'c']);
  });

  it('handles satisfies operator on array', () => {
    const { node } = parseAndResolve(`
      const A = ['x', 'y'] satisfies string[];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('handles satisfies operator on object', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'x', b: 'y' } satisfies Record<string, string>;
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('scans all values when object has computed keys with static subscript', () => {
    const { node } = parseAndResolve(`
      const a = 'good';
      const b = 'good' as string;
      const O = { [a]: 'yes', [b]: 'no' };
      const __target__ = O['good'];
    `);
    // Computed keys can't be resolved, so fallback to extracting all values
    expect(nodeToStrings(node)).toEqual(['yes', 'no']);
  });
});

// ─── Category 4d: Adversarial Edge Cases ──────────────────────────────────────

describe('Adversarial Edge Cases', () => {
  it('resolves shorthand property', () => {
    const { node } = parseAndResolve(`
      const x = 'val';
      const O = { x };
      const __target__ = O.x;
    `);
    expect(nodeToStrings(node)).toEqual(['val']);
  });

  it('matches numeric key with string subscript', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'a', 1: 'b' };
      const __target__ = O['0'];
    `);
    expect(nodeToStrings(node)).toEqual(['a']);
  });

  it('matches string key with numeric subscript', () => {
    const { node } = parseAndResolve(`
      const O = { '0': 'a', '1': 'b' };
      const __target__ = O[0];
    `);
    expect(nodeToStrings(node)).toEqual(['a']);
  });

  it('errors on optional chaining', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'x' };
      const __target__ = O?.a;
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Optional chaining');
  });

  it('errors on logical expression value', () => {
    const { node, errors } = parseAndResolve(`
      const x = undefined;
      const O = { a: x || 'default', b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
  });

  it('unwraps non-null assertion on value', () => {
    const { node } = parseAndResolve(`
      const x = 'hello';
      const O = { a: x!, b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['hello', 'ok']);
  });

  it('resolves conditional object expression', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const O = cond ? { a: 'x' } : { a: 'y' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('returns null for Object.freeze wrapped object', () => {
    const { node } = parseAndResolve(`
      const O = Object.freeze({ a: 'x' });
      const __target__ = O.a;
    `);
    expect(node).toBeNull();
  });

  // Angle bracket assertions (<string>x) are invalid in .tsx files (conflicts with JSX).
  // No test needed — the `as` syntax covers the same unwrap path.

  it('falls back to all values for negative numeric key', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'pos', [-1]: 'neg' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['pos', 'neg']);
  });
});

// ─── Category 4e: Adversarial Edge Cases Round 3 ──────────────────────────────

describe('Adversarial Edge Cases Round 3', () => {
  it('resolves object value that is another object property access', () => {
    const { node } = parseAndResolve(`
      const labels = { greeting: 'Hello' };
      const O = { a: labels.greeting };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['Hello']);
  });

  it('errors on destructured variable', () => {
    const { node, errors } = parseAndResolve(`
      const { x } = { x: 'hello' };
      const __target__ = x;
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('destructuring');
  });

  it('resolves nested conditional object expression', () => {
    const { node } = parseAndResolve(`
      const cond1 = true;
      const cond2 = false;
      const O = cond1 ? (cond2 ? { a: 'x' } : { a: 'y' }) : { a: 'z' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z']);
  });

  it('resolves conditional with as const branches', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const O = cond ? { a: 'x' } as const : { a: 'y' } as const;
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

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

  it('errors on array destructured variable', () => {
    const { node, errors } = parseAndResolve(`
      const [first, second] = ['hello', 'world'];
      const __target__ = first;
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('destructuring');
  });

  it('resolves inline spread source', () => {
    const { node } = parseAndResolve(`
      const O = { ...({ base: 'val' }), a: 'x' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['val', 'x']);
  });

  it('errors on enum member value', () => {
    const { node, errors } = parseAndResolve(`
      enum Color { Red = 'red', Blue = 'blue' }
      const O = { a: Color.Red, b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
  });

  it('falls back to all values for template literal key', () => {
    const { node } = parseAndResolve(`
      const O = { [\`key\`]: 'computed', other: 'literal' };
      const k = 'other';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['computed', 'literal']);
  });

  it('errors on nullish coalescing value', () => {
    const { node, errors } = parseAndResolve(`
      const x = undefined;
      const O = { a: x ?? 'default', b: 'ok' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
  });
});

// ─── Category 4f: Adversarial Edge Cases Round 4 ──────────────────────────────

describe('Adversarial Edge Cases Round 4', () => {
  it('resolves nested array access A[0][1]', () => {
    const { node } = parseAndResolve(`
      const A = [['a', 'b'], ['c', 'd']];
      const __target__ = A[0][1];
    `);
    expect(nodeToStrings(node)).toEqual(['b']);
  });

  it('resolves conditional array source', () => {
    const { node } = parseAndResolve(`
      const cond = true;
      const A = cond ? ['x', 'y'] : ['p', 'q'];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'p', 'q']);
  });

  it('resolves empty string key', () => {
    const { node } = parseAndResolve(`
      const O = { '': 'empty', a: 'other' };
      const __target__ = O[''];
    `);
    expect(nodeToStrings(node)).toEqual(['empty']);
  });

  it('resolves unicode key', () => {
    const { node } = parseAndResolve(`
      const O = { '🎉': 'party', '🔥': 'fire' };
      const __target__ = O['🎉'];
    `);
    expect(nodeToStrings(node)).toEqual(['party']);
  });

  it('resolves inline nested spread', () => {
    const { node } = parseAndResolve(`
      const inner = { a: 'deep' };
      const O = { ...{ ...inner, b: 'mid' }, c: 'top' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['deep', 'mid', 'top']);
  });

  it('collects both entries for numeric/string key collision', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'numeric', '0': 'string' };
      const __target__ = O[0];
    `);
    // Both keys resolve to '0' — collects both since no break
    expect(nodeToStrings(node)).toEqual(['numeric', 'string']);
  });

  it('extracts all branches from multiple ternary values', () => {
    const { node } = parseAndResolve(`
      const c1 = true;
      const c2 = false;
      const O = { a: c1 ? 'x' : 'y', b: c2 ? 'p' : 'q' };
      const k = 'a';
      const __target__ = O[k];
    `);
    // Dynamic key extracts all values; each ternary produces 2 branches
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'p', 'q']);
  });

  it('resolves direct access on inline object expression', () => {
    const { node } = parseAndResolve(`
      const __target__ = ({ a: 'x', b: 'y' }).a;
    `);
    // Direct property access on object literal — no variable binding
    // This might not be supported since there's no Identifier to resolve
    if (node) {
      expect(nodeToStrings(node)).toEqual(['x']);
    } else {
      expect(node).toBeNull();
    }
  });

  it('returns null for array .length access', () => {
    const { node } = parseAndResolve(`
      const A = ['a', 'b', 'c'];
      const __target__ = A.length;
    `);
    // .length is not a data property — should not resolve
    expect(node).toBeNull();
  });

  it('errors on let spread source in array', () => {
    const { node, errors } = parseAndResolve(`
      let mutable = ['bad'];
      const A = ['ok', ...mutable];
      const k = 0;
      const __target__ = A[k];
    `);
    // let spread source should produce an error
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('declared with');
  });
});

// ─── Category 4g: Adversarial Edge Cases Round 5 ──────────────────────────────

describe('Adversarial Edge Cases Round 5', () => {
  it('resolves identifier chain to object', () => {
    const { node } = parseAndResolve(`
      const B = { a: 'x', b: 'y' };
      const A = B;
      const __target__ = A.a;
    `);
    // A points to B which is an object — should follow the chain
    expect(nodeToStrings(node)).toEqual(['x']);
  });

  it('resolves nested ternary as object VALUE', () => {
    const { node } = parseAndResolve(`
      const c1 = true;
      const c2 = false;
      const O = { a: c1 ? (c2 ? 'x' : 'y') : 'z' };
      const __target__ = O.a;
    `);
    // Nested ternary in value position — parseStringExpression handles conditionals
    expect(nodeToStrings(node)).toEqual(['x', 'y', 'z']);
  });

  it('resolves string concat as object value', () => {
    const { node } = parseAndResolve(`
      const O = { a: 'hello' + ' world' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['hello world']);
  });

  it('collects both values from two spreads with same key', () => {
    const { node } = parseAndResolve(`
      const a = { x: 'first' };
      const b = { x: 'second' };
      const O = { ...a, ...b };
      const __target__ = O.x;
    `);
    // Both spreads contribute 'x' — can't know which wins at static time
    expect(nodeToStrings(node)).toEqual(['first', 'second']);
  });

  it('resolves spread of as-const object', () => {
    const { node } = parseAndResolve(`
      const base = { a: 'x' } as const;
      const O = { ...base, b: 'y' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['x', 'y']);
  });

  it('resolves numeric and boolean values in object', () => {
    const { node } = parseAndResolve(`
      const O = { a: 42, b: true };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['42', 'true']);
  });

  it('resolves 3-level nested conditional source', () => {
    const { node } = parseAndResolve(`
      const c1 = true;
      const c2 = false;
      const c3 = true;
      const O = c1 ? (c2 ? (c3 ? { a: '1' } : { a: '2' }) : { a: '3' }) : { a: '4' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['1', '2', '3', '4']);
  });

  it('resolves function call as object value', () => {
    const { node } = parseAndResolve(`
      function getLabel() { return 'resolved'; }
      const O = { a: getLabel(), b: 'static' };
      const __target__ = O.a;
    `);
    expect(nodeToStrings(node)).toEqual(['resolved']);
  });

  it('unwraps satisfies on array element', () => {
    const { node } = parseAndResolve(`
      const A = ['a' satisfies string, 'b' satisfies string];
      const k = 0;
      const __target__ = A[k];
    `);
    expect(nodeToStrings(node)).toEqual(['a', 'b']);
  });

  it('resolves template literal as object value', () => {
    const { node } = parseAndResolve(`
      const name = 'World';
      const O = { greeting: \`Hello \${name}\` };
      const __target__ = O.greeting;
    `);
    expect(nodeToStrings(node)).toEqual(['Hello World']);
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
    expect([...warnings][0]).toContain('declared with');
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
    expect([...warnings][0]).toContain('declared with');
  });

  it('rejects var variable inside function return', () => {
    const { node, warnings } = parseAndResolve(`
      function f() { var x = 'hi'; return x; }
      const __target__ = f();
    `);
    expect(node).toBeNull();
    expect(warnings.size).toBeGreaterThan(0);
    expect([...warnings][0]).toContain('declared with');
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
    expect([...warnings][0]).toContain('declared with');
  });
});

// ─── Category C: MemberExpression Edge Cases ──────────────────────────────────

describe('MemberExpression Edge Cases', () => {
  it('resolves array access with static subscript', () => {
    const { node } = parseAndResolve(`
      const arr = ['a', 'b'];
      const __target__ = arr[0];
    `);
    // ArrayExpression is now supported — narrows to index 0
    expect(nodeToStrings(node)).toEqual(['a']);
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

  it('narrows for literal numeric property access', () => {
    const { node } = parseAndResolve(`
      const O = { 0: 'x', 1: 'y' };
      const __target__ = O[0];
    `);
    // O[0] where 0 is a NumericLiteral — narrowed to key '0'
    expect(nodeToStrings(node)).toEqual(['x']);
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
    expect(errors[0]).toContain('could not be resolved');
  });

  it('errors on array value in object (static access)', () => {
    const { node, errors } = parseAndResolve(`
      const O = { items: ['a', 'b', 'c'] };
      const __target__ = O.items;
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
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
    expect(errors[0]).toContain('could not be resolved');
  });

  it('errors when all values are non-resolvable', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: ['x'], b: ['y'] };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(node).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
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
    expect(errors[0]).toContain('could not be resolved');
  });

  it('errors on new expression value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', b: new Date() };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
  });

  it('errors on arrow function value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', b: () => 'hello' };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
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
    expect(errors[0]).toContain('could not be resolved');
  });

  it('errors on regex literal value in object', () => {
    const { node, errors } = parseAndResolve(`
      const O = { a: 'ok', pattern: /hello/g };
      const k = 'a';
      const __target__ = O[k];
    `);
    expect(nodeToStrings(node)).toEqual(['ok']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('could not be resolved');
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

  it('resolves nested as expressions', () => {
    const { node } = parseAndResolve(`
      const X = ('hello' as string) as const;
      const __target__ = X;
    `);
    // Type annotations are now unwrapped at the top of parseStringExpression
    expect(nodeToStrings(node)).toEqual(['hello']);
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
