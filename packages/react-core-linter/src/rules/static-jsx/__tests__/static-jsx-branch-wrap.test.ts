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
// Ternary → Branch conversion
// ===================================================================

describe('static-jsx: ternary with string branches → Branch', () => {
  ruleTester.run('ternary-string-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: ternary with JSX branches → Branch', () => {
  ruleTester.run('ternary-jsx-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? <b>Bold</b> : <i>Italic</i>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={<b>Bold</b>}><i>Italic</i></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: equality comparison → Branch with extracted prop name', () => {
  ruleTester.run('equality-comparison', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ gender }) {
            return <T>{gender === "male" ? "boy" : "girl"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ gender }) {
            return <T><Branch branch={gender} male="boy">girl</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: reversed equality comparison → Branch with extracted prop name', () => {
  ruleTester.run('reversed-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ gender }) {
            return <T>{"male" === gender ? "boy" : "girl"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ gender }) {
            return <T><Branch branch={gender} male="boy">girl</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: inequality comparison → Branch with swapped branches', () => {
  ruleTester.run('inequality-comparison', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ gender }) {
            return <T>{gender !== "male" ? "other" : "boy"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ gender }) {
            return <T><Branch branch={gender} male="boy">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: negated condition → Branch with swapped branches', () => {
  ruleTester.run('negated-condition', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{!cond ? "no" : "yes"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: nested ternary → recursive Branch', () => {
  ruleTester.run('nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a ? "x" : b ? "y" : "z"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} true="x"><Branch branch={b} true="y">z</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: nested ternary with equality → collapsed Branch props', () => {
  ruleTester.run('nested-equality-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ temp }) {
            return <T>{temp === "a" ? "A" : temp === "b" ? "B" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ temp }) {
            return <T><Branch branch={temp} a="A"><Branch branch={temp} b="B">other</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: one branch translatable, other dynamic → Branch', () => {
  ruleTester.run('one-branch-translatable', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, someVar }) {
            return <T>{cond ? "yes" : someVar}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond, someVar }) {
            return <T><Branch branch={cond} true="yes">{someVar}</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: both branches dynamic → Var fallback', () => {
  ruleTester.run('both-dynamic-var-fallback', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, a, b }) {
            return <T>{cond ? a : b}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond, a, b }) {
            return <T><Var>{cond ? a : b}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: ternary with static template literal branches → Branch', () => {
  ruleTester.run('ternary-template-literals', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? \`hello\` : \`world\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="hello">world</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: ternary with mixed string and JSX → Branch', () => {
  ruleTester.run('ternary-mixed-string-jsx', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? <b>Bold</b> : "plain"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={<b>Bold</b>}>plain</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Logical AND → Branch conversion
// ===================================================================

describe('static-jsx: logical AND with string → Branch', () => {
  ruleTester.run('logical-and-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isActive }) {
            return <T>{isActive && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ isActive }) {
            return <T><Branch branch={!!isActive} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: logical AND with JSX → Branch', () => {
  ruleTester.run('logical-and-jsx', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isAdmin }) {
            return <T>{isAdmin && <span>Admin Panel</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ isAdmin }) {
            return <T><Branch branch={!!isAdmin} true={<span>Admin Panel</span>} /></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: logical AND with dynamic content → Var fallback', () => {
  ruleTester.run('logical-and-dynamic-var-fallback', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isAdmin, label }) {
            return <T>{isAdmin && label}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ isAdmin, label }) {
            return <T><Var>{isAdmin && label}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Import management
// ===================================================================

describe('static-jsx: Branch import auto-added when not present', () => {
  ruleTester.run('branch-auto-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: Branch already imported → no duplicate', () => {
  ruleTester.run('branch-no-duplicate-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: Branch aliased import → use alias', () => {
  ruleTester.run('branch-alias-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch as B } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch as B } from 'gt-react';
          function Component({ cond }) {
            return <T><B branch={cond} true="a">b</B></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: Branch import added alongside existing specifiers', () => {
  ruleTester.run('branch-import-alongside-others', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var, Num } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var, Num, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: Branch import from @generaltranslation/react-core', () => {
  ruleTester.run('branch-import-react-core', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from '@generaltranslation/react-core';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from '@generaltranslation/react-core';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Regression: existing Var behavior unchanged
// ===================================================================

describe('static-jsx: non-ternary dynamic content → still Var', () => {
  ruleTester.run('regression-var-identifier', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: function call → still Var', () => {
  ruleTester.run('regression-var-function-call', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{getLabel()}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component() {
            return <T><Var>{getLabel()}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: template literal with interpolation → allowed by current rule', () => {
  ruleTester.run('regression-template-interpolation-allowed', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{\`Hello \${name}\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('static-jsx: member expression → still Var', () => {
  ruleTester.run('regression-var-member-expression', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ user }) {
            return <T>{user.name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ user }) {
            return <T><Var>{user.name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Edge cases
// ===================================================================

describe('static-jsx: ternary outside T → no error', () => {
  ruleTester.run('ternary-outside-t-no-error', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <div>{cond ? "yes" : "no"}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('static-jsx: ternary with one string and one null → Branch', () => {
  ruleTester.run('ternary-string-and-null', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes" /></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: equality with == operator → Branch', () => {
  ruleTester.run('loose-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status == "active" ? "On" : "Off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="On">Off</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: ternary with JSX containing dynamic content → Branch (inner Var on next pass)', () => {
  ruleTester.run('ternary-jsx-with-dynamic', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, name }) {
            return <T>{cond ? <span>{name}</span> : <span>Guest</span>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond, name }) {
            return <T><Branch branch={cond} true={<span>{name}</span>}><span>Guest</span></Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx: logical AND with nested ternary → Branch with nested Branch', () => {
  ruleTester.run('logical-and-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ show, type }) {
            return <T>{show && (type === "a" ? "Alpha" : "Beta")}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ show, type }) {
            return <T><Branch branch={!!show} true={<Branch branch={type} a="Alpha">Beta</Branch>} /></T>;
          }
        `,
      },
    ],
  });
});
