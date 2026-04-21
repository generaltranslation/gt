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
// VALID: Scope suppression — content outside T or inside variable/derive
// ===================================================================

describe('edge: ternary outside T — no error', () => {
  ruleTester.run('ternary-outside-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <div>{cond ? "a" : "b"}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: ternary inside Var inside T — Var suppresses checking', () => {
  ruleTester.run('ternary-in-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? "a" : "b"}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: ternary inside Derive inside T — Derive suppresses checking', () => {
  ruleTester.run('ternary-in-Derive', staticJsx, {
    valid: [
      {
        code: `
          import { T, Derive } from 'gt-react';
          function Component({ cond }) {
            return <T><Derive>{cond ? "a" : "b"}</Derive></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic content inside Num — Num suppresses checking', () => {
  ruleTester.run('dynamic-in-Num', staticJsx, {
    valid: [
      {
        code: `
          import { T, Num } from 'gt-react';
          function Component({ count }) {
            return <T><Num>{count}</Num></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic content inside Currency — Currency suppresses checking', () => {
  ruleTester.run('dynamic-in-Currency', staticJsx, {
    valid: [
      {
        code: `
          import { T, Currency } from 'gt-react';
          function Component({ amount }) {
            return <T><Currency>{amount}</Currency></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic content inside DateTime — DateTime suppresses checking', () => {
  ruleTester.run('dynamic-in-DateTime', staticJsx, {
    valid: [
      {
        code: `
          import { T, DateTime } from 'gt-react';
          function Component({ date }) {
            return <T><DateTime>{date}</DateTime></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic content NOT inside T at all', () => {
  ruleTester.run('dynamic-outside-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <div>{name}</div>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: static text content in T — no error', () => {
  ruleTester.run('static-text-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>Hello world</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: string literal expression in T — no error', () => {
  ruleTester.run('string-literal-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{"hello"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: numeric literal expression in T — no error', () => {
  ruleTester.run('numeric-literal-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{42}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// VALID: Deeper nesting suppression
// ===================================================================

describe('edge: dynamic content inside Var deeply nested in T', () => {
  ruleTester.run('deep-Var-suppression', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ name, count }) {
            return (
              <T>
                Hello <Var>{name}</Var>, you have <Var>{count}</Var> messages
              </T>
            );
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: function call inside Var inside T — no error', () => {
  ruleTester.run('fn-call-in-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component() {
            return <T><Var>{getLabel()}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: member expression inside Var inside T — no error', () => {
  ruleTester.run('member-expr-in-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ user }) {
            return <T><Var>{user.name}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic content inside Static (deprecated) inside T — suppresses checking', () => {
  ruleTester.run('dynamic-in-Static', staticJsx, {
    valid: [
      {
        code: `
          import { T, Static } from 'gt-react';
          function Component({ cond }) {
            return <T><Static>{cond ? "a" : "b"}</Static></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: multiple Var siblings inside T — no error', () => {
  ruleTester.run('multiple-Var-siblings', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ first, last }) {
            return <T><Var>{first}</Var> <Var>{last}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: Num and Currency siblings inside T — no error', () => {
  ruleTester.run('Num-Currency-siblings', staticJsx, {
    valid: [
      {
        code: `
          import { T, Num, Currency } from 'gt-react';
          function Component({ count, price }) {
            return <T><Num>{count}</Num> items at <Currency>{price}</Currency></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: Branch with static content inside T — no error', () => {
  ruleTester.run('Branch-static-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ gender }) {
            return <T><Branch branch={gender} male="Mr." female="Ms.">Mx.</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: Plural with static content inside T — no error', () => {
  ruleTester.run('Plural-static-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T, Plural } from 'gt-react';
          function Component({ n }) {
            return <T><Plural n={n} one="item">items</Plural></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: Derive nested inside Var inside T — both suppress', () => {
  ruleTester.run('Derive-in-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var, Derive } from 'gt-react';
          function Component({ x }) {
            return <T><Var><Derive>{x}</Derive></Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: T not imported from GT library — no error', () => {
  ruleTester.run('T-not-from-GT', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'some-other-library';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: component named T but not imported — no error', () => {
  ruleTester.run('T-not-imported', staticJsx, {
    valid: [
      {
        code: `
          function T({ children }) { return <div>{children}</div>; }
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: Ternary inside nested HTML elements in T
// ===================================================================

describe('edge: ternary inside nested elements in T — Branch fix', () => {
  ruleTester.run('ternary-nested-html-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T><div><span>{cond ? "a" : "b"}</span></div></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><div><span><Branch branch={cond} true="a">b</Branch></span></div></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: ternary inside T with sibling Var — Branch fix on ternary only', () => {
  ruleTester.run('ternary-sibling-Var', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Var>{x}</Var>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var, Branch } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Var>{x}</Var><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: multiple dynamic expressions in T — Var for identifier, Branch for ternary', () => {
  ruleTester.run('multiple-dynamic-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name, cond }) {
            return <T>{name}{cond ? "a" : "b"}</T>;
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
          function Component({ name, cond }) {
            return <T><Var>{name}</Var>{cond ? "a" : "b"}</T>;
          }
        `,
          `
          import { T, Var, Branch } from 'gt-react';
          function Component({ name, cond }) {
            return <T><Var>{name}</Var><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

describe('edge: ternary inside T with existing Branch sibling', () => {
  ruleTester.run('ternary-with-Branch-sibling', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Branch branch={x} a="A">B</Branch>{cond ? "c" : "d"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Branch branch={x} a="A">B</Branch><Branch branch={cond} true="c">d</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// INVALID: Different GT library imports
// ===================================================================

describe('edge: dynamic content in T from gt-next', () => {
  ruleTester.run('dynamic-in-T-gt-next', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-next';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: dynamic content in T from @generaltranslation/react-core', () => {
  ruleTester.run('dynamic-in-T-react-core', staticJsx, {
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

describe('edge: dynamic content in T with multiple libs configured', () => {
  ruleTester.run('dynamic-in-T-multi-libs', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
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

// ===================================================================
// INVALID: Aliased T import
// ===================================================================

describe('edge: ternary inside T imported with alias', () => {
  ruleTester.run('aliased-T-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Trans } from 'gt-react';
          function Component({ cond }) {
            return <Trans>{cond ? "a" : "b"}</Trans>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Trans, Branch } from 'gt-react';
          function Component({ cond }) {
            return <Trans><Branch branch={cond} true="a">b</Branch></Trans>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// INVALID: Nested T components
// ===================================================================

describe('edge: nested T components with ternary in inner T', () => {
  ruleTester.run('nested-T-ternary-inner', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>Outer <T>{cond ? "a" : "b"}</T></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T>Outer <T><Branch branch={cond} true="a">b</Branch></T></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// INVALID: Branch/Plural attribute context
// ===================================================================

describe('edge: ternary inside Branch prop value (branching attribute context)', () => {
  ruleTester.run('ternary-in-Branch-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Branch branch={x} a={cond ? "one" : "two"}>fallback</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // NOTE: The fix replaces the JSXExpressionContainer (including its braces),
        // so the outer curly braces are lost in the attribute value — known implementation quirk.
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, cond }) {
            return <T><Branch branch={x} a=<Branch branch={cond} true="one">two</Branch>>fallback</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: dynamic identifier inside Branch prop value — Var wrap', () => {
  ruleTester.run('dynamic-in-Branch-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x, label }) {
            return <T><Branch branch={x} a={label}>fallback</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // NOTE: The fix replaces the JSXExpressionContainer (including its braces),
        // so the outer curly braces are lost in the attribute value — known implementation quirk.
        output: `
          import { T, Branch, Var } from 'gt-react';
          function Component({ x, label }) {
            return <T><Branch branch={x} a=<Var>{label}</Var>>fallback</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// INVALID: Ternary inside span inside T — HTML does not suppress
// ===================================================================

describe('edge: ternary in non-GT component (span) inside T — still caught', () => {
  ruleTester.run('ternary-in-span-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T><span>{cond ? "a" : "b"}</span></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><span><Branch branch={cond} true="a">b</Branch></span></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: identifier in div inside T — still caught, Var wrap', () => {
  ruleTester.run('identifier-in-div-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T><div>{name}</div></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><div><Var>{name}</Var></div></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// VALID: Branching component branch/n prop — not content, skip checking
// ===================================================================

describe('edge: branch prop value on Branch is not checked', () => {
  ruleTester.run('branch-prop-not-checked', staticJsx, {
    valid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="Yes">No</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: n prop value on Plural is not checked', () => {
  ruleTester.run('n-prop-not-checked', staticJsx, {
    valid: [
      {
        code: `
          import { T, Plural } from 'gt-react';
          function Component({ count }) {
            return <T><Plural n={count} one="item">items</Plural></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// VALID: Static JSX content inside Branch attribute values
// ===================================================================

describe('edge: JSX element inside Branch prop value — valid', () => {
  ruleTester.run('jsx-in-Branch-prop', staticJsx, {
    valid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} a={<b>bold</b>}>fallback</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: string literal inside Branch prop value — valid', () => {
  ruleTester.run('string-in-Branch-prop', staticJsx, {
    valid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} a={"hello"}>fallback</Branch></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: Logical AND inside scope variants
// ===================================================================

describe('edge: logical AND inside span inside T — still caught', () => {
  ruleTester.run('logical-and-in-span-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ isActive }) {
            return <T><span>{isActive && "Active"}</span></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ isActive }) {
            return <T><span><Branch branch={!!isActive} true="Active" /></span></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: logical AND inside Var inside T — no error', () => {
  ruleTester.run('logical-and-in-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ isActive }) {
            return <T><Var>{isActive && "Active"}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Edge: Var/Derive imported from wrong library — not recognized
// ===================================================================

describe('edge: Var imported from wrong library — not recognized as variable component', () => {
  ruleTester.run('Var-wrong-lib', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Var } from 'some-other-library';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // The non-GT Var is not recognized, so the rule wraps in a GT Var,
        // producing double-wrapping. Also adds Var to the gt-react import.
        output: `
          import { T, Var } from 'gt-react';
          import { Var } from 'some-other-library';
          function Component({ name }) {
            return <T><Var><Var>{name}</Var></Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// VALID: Deeply nested static content in T
// ===================================================================

describe('edge: deeply nested static text in T — no error', () => {
  ruleTester.run('deep-static-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return (
              <T>
                <div>
                  <span>
                    <b>
                      Hello world
                    </b>
                  </span>
                </div>
              </T>
            );
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: deeply nested string literal expression in T — no error', () => {
  ruleTester.run('deep-string-literal-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T><div><span>{"hello"}</span></div></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: Multiple ternaries in T
// ===================================================================

describe('edge: two ternaries in T — two Branch fixes', () => {
  ruleTester.run('two-ternaries-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a ? "x" : "y"}{b ? "m" : "n"}</T>;
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
            return <T><Branch branch={a} true="x">y</Branch>{b ? "m" : "n"}</T>;
          }
        `,
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} true="x">y</Branch><Branch branch={b} true="m">n</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// INVALID: Multiple identifiers in T — multiple Var wraps
// ===================================================================

describe('edge: two identifiers in T — two Var wraps', () => {
  ruleTester.run('two-identifiers-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ first, last }) {
            return <T>{first} {last}</T>;
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
          function Component({ first, last }) {
            return <T><Var>{first}</Var> {last}</T>;
          }
        `,
          `
          import { T, Var } from 'gt-react';
          function Component({ first, last }) {
            return <T><Var>{first}</Var> <Var>{last}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// Edge: Var and Branch siblings — mixed fixes
// ===================================================================

describe('edge: identifier then ternary then identifier in T — Var, Branch, Var', () => {
  ruleTester.run('mixed-dynamic-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, cond, b }) {
            return <T>{a}{cond ? "x" : "y"}{b}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Var } from 'gt-react';
          function Component({ a, cond, b }) {
            return <T><Var>{a}</Var>{cond ? "x" : "y"}{b}</T>;
          }
        `,
          `
          import { T, Var, Branch } from 'gt-react';
          function Component({ a, cond, b }) {
            return <T><Var>{a}</Var><Branch branch={cond} true="x">y</Branch>{b}</T>;
          }
        `,
          `
          import { T, Var, Branch } from 'gt-react';
          function Component({ a, cond, b }) {
            return <T><Var>{a}</Var><Branch branch={cond} true="x">y</Branch><Var>{b}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// VALID: Plural with JSX in attribute value
// ===================================================================

describe('edge: Plural with JSX in attribute value — valid', () => {
  ruleTester.run('Plural-jsx-attr', staticJsx, {
    valid: [
      {
        code: `
          import { T, Plural } from 'gt-react';
          function Component({ n }) {
            return <T><Plural n={n} one={<b>1 item</b>}>items</Plural></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: dynamic Plural attribute value
// ===================================================================

describe('edge: dynamic identifier in Plural prop value — Var wrap', () => {
  ruleTester.run('dynamic-in-Plural-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Plural } from 'gt-react';
          function Component({ n, label }) {
            return <T><Plural n={n} one={label}>items</Plural></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // NOTE: The fix replaces the JSXExpressionContainer (including its braces),
        // so the outer curly braces are lost in the attribute value — known implementation quirk.
        output: `
          import { T, Plural, Var } from 'gt-react';
          function Component({ n, label }) {
            return <T><Plural n={n} one=<Var>{label}</Var>>items</Plural></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// VALID: Sibling T components are independent scopes
// ===================================================================

describe('edge: sibling T components — independent scopes', () => {
  ruleTester.run('sibling-T-independent', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return (
              <div>
                <T>First</T>
                <T>Second</T>
              </div>
            );
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: dynamic between sibling T components — no error', () => {
  ruleTester.run('dynamic-between-T-siblings', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return (
              <div>
                <T>Hello</T>
                {name}
                <T>World</T>
              </div>
            );
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: Dynamic content in nested HTML inside nested T
// ===================================================================

describe('edge: dynamic in div in inner T in outer T', () => {
  ruleTester.run('dynamic-in-nested-T-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>Outer <T><div>{name}</div></T></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T>Outer <T><div><Var>{name}</Var></div></T></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Edge: T aliased and Var aliased together
// ===================================================================

describe('edge: both T and Var aliased', () => {
  ruleTester.run('T-and-Var-aliased', staticJsx, {
    valid: [
      {
        code: `
          import { T as Trans, Var as Variable } from 'gt-react';
          function Component({ name }) {
            return <Trans><Variable>{name}</Variable></Trans>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// VALID: Empty T component
// ===================================================================

describe('edge: empty T component — no error', () => {
  ruleTester.run('empty-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: self-closing T component — no error', () => {
  ruleTester.run('self-closing-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T />;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Edge: Boolean literal in T — allowed (it's a Literal)
// ===================================================================

describe('edge: boolean literal in T — no error', () => {
  ruleTester.run('boolean-literal-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{true}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: null literal in T — no error', () => {
  ruleTester.run('null-literal-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// INVALID: Call expression deep in HTML in T
// ===================================================================

describe('edge: function call inside deeply nested HTML in T', () => {
  ruleTester.run('fn-call-deep-html-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return (
              <T>
                <div>
                  <p>
                    <span>{getLabel()}</span>
                  </p>
                </div>
              </T>
            );
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component() {
            return (
              <T>
                <div>
                  <p>
                    <span><Var>{getLabel()}</Var></span>
                  </p>
                </div>
              </T>
            );
          }
        `,
      },
    ],
  });
});

// ===================================================================
// VALID: Mixed static and Var content in T
// ===================================================================

describe('edge: mixed static text and Var in T — no error', () => {
  ruleTester.run('mixed-static-Var', staticJsx, {
    valid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T>Hello <Var>{name}</Var>, welcome!</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// VALID: Branch and Var siblings inside T — all wrapped correctly
// ===================================================================

describe('edge: Branch and Var siblings in T — all valid', () => {
  ruleTester.run('Branch-Var-siblings', staticJsx, {
    valid: [
      {
        code: `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond, name }) {
            return <T><Branch branch={cond} true="yes">no</Branch> <Var>{name}</Var></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Edge: Derive with complex content — suppressed
// ===================================================================

describe('edge: Derive with function call and member expression — suppressed', () => {
  ruleTester.run('Derive-complex', staticJsx, {
    valid: [
      {
        code: `
          import { T, Derive } from 'gt-react';
          function Component({ obj }) {
            return <T><Derive>{obj.method()}</Derive></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Edge: Scope isolation after exiting Var
// ===================================================================

describe('edge: dynamic content after Var exit still caught', () => {
  ruleTester.run('after-Var-exit', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ a, b }) {
            return <T><Var>{a}</Var>{b}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ a, b }) {
            return <T><Var>{a}</Var><Var>{b}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('edge: dynamic content after Derive exit still caught', () => {
  ruleTester.run('after-Derive-exit', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Derive } from 'gt-react';
          function Component({ a, b }) {
            return <T><Derive>{a}</Derive>{b}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Derive, Var } from 'gt-react';
          function Component({ a, b }) {
            return <T><Derive>{a}</Derive><Var>{b}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Edge: JSX fragment inside T
// ===================================================================

describe('edge: JSX fragment with static content inside T — no error', () => {
  ruleTester.run('fragment-static-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T><>Hello world</></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

describe('edge: JSX fragment with dynamic content inside T — caught', () => {
  ruleTester.run('fragment-dynamic-in-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T><>{name}</></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><><Var>{name}</Var></></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Edge: Ternary with null branches
// ===================================================================

describe('edge: ternary with null consequent inside T — Branch', () => {
  ruleTester.run('ternary-null-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? null : "fallback"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // null consequent is passed through as {null} in prop value,
        // alternate becomes children text.
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={null}>fallback</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Edge: Template literal (no interpolation) in T — allowed
// ===================================================================

describe('edge: static template literal in T — no error', () => {
  ruleTester.run('static-template-in-T', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{\`hello world\`}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
