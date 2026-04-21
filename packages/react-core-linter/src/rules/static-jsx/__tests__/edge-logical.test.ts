import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
import { staticJsx } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

// ===================================================================
// Logical AND (&&) — basic cases
// ===================================================================

describe('logical-and: basic AND with string literal', () => {
  ruleTester.run('and-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with JSX element', () => {
  ruleTester.run('and-jsx-element', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && <div>Content</div>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true={<div>Content</div>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with JSX fragment', () => {
  ruleTester.run('and-jsx-fragment', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && <>Fragment content</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true={<>Fragment content</>} /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — dynamic right side (Var fallback)
// ===================================================================

describe('logical-and: AND with dynamic identifier right side', () => {
  ruleTester.run('and-dynamic-identifier', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, someVar }) {
            return <T>{x && someVar}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x, someVar }) {
            return <T><Var>{x && someVar}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with function call right side', () => {
  ruleTester.run('and-dynamic-function-call', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && getLabel()}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x && getLabel()}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with number literal right side', () => {
  ruleTester.run('and-number-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && 42}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x && 42}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with boolean literal right side', () => {
  ruleTester.run('and-boolean-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && true}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x && true}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with null right side', () => {
  ruleTester.run('and-null-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x && null}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — left side variations
// ===================================================================

describe('logical-and: negated left side', () => {
  ruleTester.run('and-negated-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: member expression left side', () => {
  ruleTester.run('and-member-expression-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x.isAdmin && "Admin"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x.isAdmin} true="Admin" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: function call left side', () => {
  ruleTester.run('and-function-call-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{getFlag() && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component() {
            return <T><Branch branch={!!getFlag()} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — template literals
// ===================================================================

describe('logical-and: AND with static template literal', () => {
  ruleTester.run('and-static-template-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && \`hello\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="hello" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with dynamic template literal', () => {
  ruleTester.run('and-dynamic-template-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, name }) {
            return <T>{x && \`hello \${name}\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x, name }) {
            return <T><Var>{x && \`hello \${name}\`}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — nested / chained
// ===================================================================

describe('logical-and: AND with nested ternary (translatable)', () => {
  ruleTester.run('and-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x && (y ? "a" : "b")}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, y }) {
            return <T><Branch branch={!!x} true={<Branch branch={y} true="a">b</Branch>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: chained AND — (x && y) && "text"', () => {
  ruleTester.run('chained-and', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x && y && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, y }) {
            return <T><Branch branch={!!x && y} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — JSX with dynamic content (multi-pass)
// ===================================================================

describe('logical-and: AND with JSX containing dynamic content', () => {
  ruleTester.run('and-jsx-with-dynamic', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, name }) {
            return <T>{x && <span>{name}</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Var } from 'gt-react';
          function Component({ x, name }) {
            return <T>{x && <span><Var>{name}</Var></span>}</T>;
          }
        `,
          `
          import { T, Var, Branch } from 'gt-react';
          function Component({ x, name }) {
            return <T><Branch branch={!!x} true={<span><Var>{name}</Var></span>} /></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// Logical OR (||) — falls through to Var
// ===================================================================

describe('logical-or: OR with string literal', () => {
  ruleTester.run('or-string-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x || "fallback"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x || "fallback"}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-or: OR with JSX element', () => {
  ruleTester.run('or-jsx-element', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x || <span>Default</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x || <span>Default</span>}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-or: OR with dynamic right side', () => {
  ruleTester.run('or-dynamic-right', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x || y}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x, y }) {
            return <T><Var>{x || y}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Nullish coalescing (??) — falls through to Var
// ===================================================================

describe('nullish-coalescing: ?? with string literal', () => {
  ruleTester.run('nullish-string-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x ?? "default"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x ?? "default"}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('nullish-coalescing: ?? with JSX element', () => {
  ruleTester.run('nullish-jsx-element', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x ?? <span>Fallback</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x ?? <span>Fallback</span>}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('nullish-coalescing: ?? with dynamic right side', () => {
  ruleTester.run('nullish-dynamic-right', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x ?? y}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x, y }) {
            return <T><Var>{x ?? y}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Multiple logical expressions in same T
// ===================================================================

describe('logical-and: multiple ANDs in same T component', () => {
  ruleTester.run('multiple-ands-same-t', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a && "x"}{b && "y"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="x" />{b && "y"}</T>;
          }
        `,
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="x" /><Branch branch={!!b} true="y" /></T>;
          }
        `,
        ],
      },
    ],
  });
});

describe('logical: AND and OR in same T component', () => {
  ruleTester.run('and-and-or-same-t', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a && "x"}{b || "y"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="x" />{b || "y"}</T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="x" /><Var>{b || "y"}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — surrounded by text
// ===================================================================

describe('logical-and: AND inside surrounding text', () => {
  ruleTester.run('and-with-surrounding-text', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isActive }) {
            return <T>Status: {isActive && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ isActive }) {
            return <T>Status: <Branch branch={!!isActive} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND between text nodes', () => {
  ruleTester.run('and-between-text', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isAdmin }) {
            return <T>User is {isAdmin && "an admin"} today</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ isAdmin }) {
            return <T>User is <Branch branch={!!isAdmin} true="an admin" /> today</T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Import management with logical expressions
// ===================================================================

describe('logical-and: Branch already imported — no duplicate', () => {
  ruleTester.run('and-branch-already-imported', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: Branch aliased import — use alias', () => {
  ruleTester.run('and-branch-aliased', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch as B } from 'gt-react';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch as B } from 'gt-react';
          function Component({ x }) {
            return <T><B branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: Branch import added alongside Var', () => {
  ruleTester.run('and-branch-alongside-var', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — complex left expressions
// ===================================================================

describe('logical-and: double negation on left side', () => {
  ruleTester.run('and-double-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!!x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: comparison expression on left side', () => {
  ruleTester.run('and-comparison-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ count }) {
            return <T>{count > 0 && "Has items"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ count }) {
            return <T><Branch branch={!!count > 0} true="Has items" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: parenthesized left side — getText drops parens', () => {
  // Note: sourceCode.getText() on the AST node `a || b` does not include
  // the surrounding parens, so the fix produces `!!a || b` rather than
  // `!!(a || b)`. This is a known limitation of the current implementation.
  ruleTester.run('and-parenthesized-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{(a || b) && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a || b} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: optional chaining on left side', () => {
  ruleTester.run('and-optional-chaining-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ user }) {
            return <T>{user?.isAdmin && "Admin"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ user }) {
            return <T><Branch branch={!!user?.isAdmin} true="Admin" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: computed member expression on left side', () => {
  ruleTester.run('and-computed-member-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ flags, key }) {
            return <T>{flags[key] && "Enabled"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ flags, key }) {
            return <T><Branch branch={!!flags[key]} true="Enabled" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — complex right expressions
// ===================================================================

describe('logical-and: AND with JSX element containing nested elements', () => {
  ruleTester.run('and-jsx-nested-elements', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && <div><span>Nested</span></div>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true={<div><span>Nested</span></div>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with JSX self-closing element', () => {
  ruleTester.run('and-jsx-self-closing', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && <br />}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true={<br />} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with nested AND in right (both translatable)', () => {
  ruleTester.run('and-nested-and-right', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x && (y && "nested")}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, y }) {
            return <T><Branch branch={!!x} true={<Branch branch={!!y} true="nested" />} /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND (&&) — outside T (should be valid, no error)
// ===================================================================

describe('logical-and: AND outside T — no error', () => {
  ruleTester.run('and-outside-t', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <div>{x && "text"}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('logical-or: OR outside T — no error', () => {
  ruleTester.run('or-outside-t', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <div>{x || "fallback"}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('nullish-coalescing: ?? outside T — no error', () => {
  ruleTester.run('nullish-outside-t', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <div>{x ?? "default"}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Logical AND (&&) — with different GT libraries
// ===================================================================

describe('logical-and: AND with gt-next library', () => {
  ruleTester.run('and-gt-next', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-next';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with @generaltranslation/react-core library', () => {
  ruleTester.run('and-react-core', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from '@generaltranslation/react-core';
          function Component({ x }) {
            return <T>{x && "text"}</T>;
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from '@generaltranslation/react-core';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical expression combinations
// ===================================================================

describe('logical: AND followed by nullish coalescing in same T', () => {
  ruleTester.run('and-then-nullish-same-t', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a && "yes"}{b ?? "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="yes" />{b ?? "no"}</T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={!!a} true="yes" /><Var>{b ?? "no"}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

describe('logical-and: AND with empty string right side', () => {
  ruleTester.run('and-empty-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && ""}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: three chained ANDs — x && y && z && "text"', () => {
  ruleTester.run('triple-chained-and', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y, z }) {
            return <T>{x && y && z && "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, y, z }) {
            return <T><Branch branch={!!x && y && z} true="text" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with multiline JSX right side', () => {
  ruleTester.run('and-multiline-jsx', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ show }) {
            return <T>{show && <div>
              <span>Hello</span>
            </div>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ show }) {
            return <T><Branch branch={!!show} true={<div>
              <span>Hello</span>
            </div>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with string containing special characters', () => {
  ruleTester.run('and-string-special-chars', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && "Hello, world!"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true="Hello, world!" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-or: OR with static template literal', () => {
  ruleTester.run('or-static-template', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x || \`fallback\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x || \`fallback\`}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('nullish-coalescing: ?? with static template literal', () => {
  ruleTester.run('nullish-static-template', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x ?? \`default\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ x }) {
            return <T><Var>{x ?? \`default\`}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with typeof expression on left side', () => {
  ruleTester.run('and-typeof-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{typeof x === "string" && "Is string"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!typeof x === "string"} true="Is string" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with Array.isArray on left side', () => {
  ruleTester.run('and-array-isarray-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ items }) {
            return <T>{Array.isArray(items) && "Has items"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ items }) {
            return <T><Branch branch={!!Array.isArray(items)} true="Has items" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with ternary on right where both branches are translatable', () => {
  ruleTester.run('and-ternary-both-translatable', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ show, type }) {
            return <T>{show && (type ? <b>Bold</b> : <i>Italic</i>)}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ show, type }) {
            return <T><Branch branch={!!show} true={<Branch branch={type} true={<b>Bold</b>}><i>Italic</i></Branch>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with member expression chain on left', () => {
  ruleTester.run('and-deep-member-expression', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ user }) {
            return <T>{user.profile.settings.isVisible && "Visible"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ user }) {
            return <T><Branch branch={!!user.profile.settings.isVisible} true="Visible" /></T>;
          }
        `,
      },
    ],
  });
});

describe('logical-and: AND with JSX fragment containing multiple children', () => {
  ruleTester.run('and-fragment-multiple-children', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x && <>Hello <b>world</b></>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={!!x} true={<>Hello <b>world</b></>} /></T>;
          }
        `,
      },
    ],
  });
});
