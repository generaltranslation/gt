import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
import { staticJsx } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

// ===================================================================
// Chained ternaries with same branch variable → collapsed into one Branch
// ===================================================================

describe('collapse: same variable, two branches', () => {
  ruleTester.run('collapse-two-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ status }) {
            return <T>{status === "active" ? "Connected" : status === "inactive" ? "Disconnected" : "Unknown"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ status }) {
            return <T><Branch branch={status} active="Connected" inactive="Disconnected">Unknown</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: same variable, three branches', () => {
  ruleTester.run('collapse-three-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ color }) {
            return <T>{color === "red" ? "Red" : color === "green" ? "Green" : color === "blue" ? "Blue" : "Other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ color }) {
            return <T><Branch branch={color} red="Red" green="Green" blue="Blue">Other</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: same variable with JSX branch values', () => {
  ruleTester.run('collapse-jsx-values', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ role }) {
            return <T>{role === "admin" ? <b>Admin</b> : role === "editor" ? <i>Editor</i> : <span>Viewer</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ role }) {
            return <T><Branch branch={role} admin={<b>Admin</b>} editor={<i>Editor</i>}><span>Viewer</span></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: same member expression variable', () => {
  ruleTester.run('collapse-member-expr', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ user }) {
            return <T>{user.role === "admin" ? "Admin" : user.role === "mod" ? "Moderator" : "User"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ user }) {
            return <T><Branch branch={user.role} admin="Admin" mod="Moderator">User</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: same variable with null fallback → self-closing', () => {
  ruleTester.run('collapse-null-fallback', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x }) {
            return <T>{x === "a" ? "Alpha" : x === "b" ? "Beta" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x }) {
            return <T><Branch branch={x} a="Alpha" b="Beta" /></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: reversed operands still match', () => {
  ruleTester.run('collapse-reversed-operands', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ lang }) {
            return <T>{"en" === lang ? "English" : "fr" === lang ? "French" : "Other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ lang }) {
            return <T><Branch branch={lang} en="English" fr="French">Other</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: mixed === and == still collapses when same variable', () => {
  ruleTester.run('collapse-mixed-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x }) {
            return <T>{x === "a" ? "A" : x == "b" ? "B" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x }) {
            return <T><Branch branch={x} a="A" b="B">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Should NOT collapse — different branch variables
// ===================================================================

describe('no-collapse: different variables → nested Branch', () => {
  ruleTester.run('no-collapse-different-vars', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a === "x" ? "X" : b === "y" ? "Y" : "Z"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} x="X"><Branch branch={b} y="Y">Z</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('no-collapse: numeric comparison values → fallback prop names differ', () => {
  ruleTester.run('no-collapse-numeric', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ count }) {
            return <T>{count === 0 ? "none" : count === 1 ? "one" : "many"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ count }) {
            return <T><Branch branch={count === 0} true="none"><Branch branch={count === 1} true="one">many</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('no-collapse: plain boolean conditions → different branchExpr', () => {
  ruleTester.run('no-collapse-boolean', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a ? "A" : b ? "B" : "C"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} true="A"><Branch branch={b} true="B">C</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('no-collapse: first branch has invalid prop name → different branchExpr', () => {
  ruleTester.run('no-collapse-invalid-first-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x }) {
            return <T>{x === 42 ? "forty-two" : x === "b" ? "B" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x }) {
            return <T><Branch branch={x === 42} true="forty-two"><Branch branch={x} b="B">other</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Partial collapse — first matches, later stops matching
// ===================================================================

describe('partial-collapse: first two share variable, third differs', () => {
  ruleTester.run('partial-collapse', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x, y }) {
            return <T>{x === "a" ? "A" : x === "b" ? "B" : y === "c" ? "C" : "D"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x, y }) {
            return <T><Branch branch={x} a="A" b="B"><Branch branch={y} c="C">D</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Collapse with !== (swap) — ensures swap logic still works in chain
// ===================================================================

describe('collapse: !== swaps branches correctly in chain', () => {
  ruleTester.run('collapse-inequality-chain', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x }) {
            return <T>{x !== "a" ? x === "b" ? "B" : "other" : "A"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x }) {
            return <T><Branch branch={x} a="A" b="B">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: surrounding text preserved', () => {
  ruleTester.run('collapse-with-text', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ tier }) {
            return <T><p>Plan: {tier === "free" ? "Free" : tier === "pro" ? "Professional" : "Enterprise"}</p></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ tier }) {
            return <T><p>Plan: <Branch branch={tier} free="Free" pro="Professional">Enterprise</Branch></p></T>;
          }
        `,
      },
    ],
  });
});

describe('collapse: dynamic fallback (next pass wraps in Var)', () => {
  ruleTester.run('collapse-dynamic-fallback', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x, fallback }) {
            return <T>{x === "a" ? "A" : x === "b" ? "B" : fallback}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ x, fallback }) {
            return <T><Branch branch={x} a="A" b="B">{fallback}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ x, fallback }) {
            return <T><Branch branch={x} a="A" b="B"><Var>{fallback}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

describe('collapse: hyphenated prop names', () => {
  ruleTester.run('collapse-hyphenated', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ size }) {
            return <T>{size === "x-small" ? "XS" : size === "x-large" ? "XL" : "M"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ size }) {
            return <T><Branch branch={size} x-small="XS" x-large="XL">M</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Collapse should NOT happen when inner ternary has no translatable content
// ===================================================================

describe('no-collapse: inner ternary both dynamic → not branchable, becomes raw children', () => {
  ruleTester.run('no-collapse-inner-dynamic', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x, a, b }) {
            return <T>{x === "one" ? "One" : x === "two" ? a : b}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ x, a, b }) {
            return <T><Branch branch={x} one="One">{x === "two" ? a : b}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ x, a, b }) {
            return <T><Branch branch={x} one="One"><Var>{x === "two" ? a : b}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});
