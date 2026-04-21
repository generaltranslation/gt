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
// 1. Ternary where consequent is a number literal but alternate is a string
//    Number literals are not translatable, but string is → Branch
//    (hasTranslatableContent finds the string in alternate)
// ===================================================================

describe('ternary: number consequent, string alternate → Branch', () => {
  ruleTester.run('number-consequent-string-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? 42 : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={42}>off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Ternary where both branches are boolean literals → Var
//    Boolean literals are not translatable → both branches non-translatable
//    → isBranchableConditional returns false → falls through to Var
// ===================================================================

describe('ternary: both branches boolean literals → Var', () => {
  ruleTester.run('both-boolean-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? true : false}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? true : false}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Ternary where both branches are number literals → Var
//    Number literals are not translatable → Var
// ===================================================================

describe('ternary: both branches number literals → Var', () => {
  ruleTester.run('both-number-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? 1 : 0}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? 1 : 0}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Ternary where both branches are null → Var
//    null is a Literal but typeof null !== 'string' → not translatable → Var
// ===================================================================

describe('ternary: both branches null → Var', () => {
  ruleTester.run('both-null-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? null : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? null : null}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Ternary where consequent is a function call → Var
//    Function calls are not translatable, and if neither branch is
//    translatable → isBranchableConditional = false → Var
// ===================================================================

describe('ternary: both branches are function calls → Var', () => {
  ruleTester.run('function-call-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? getLabel() : getFallback()}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? getLabel() : getFallback()}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5b. Ternary where consequent is function call but alternate is string → Branch
//     One branch is translatable → Branch
// ===================================================================

describe('ternary: function call consequent, string alternate → Branch', () => {
  ruleTester.run('function-call-consequent-string-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? getLabel() : "default"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={getLabel()}>default</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true=<Var>{getLabel()}</Var>>default</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 6. Deeply nested ternary (3 levels):
//    a ? "x" : b ? "y" : c ? "z" : "w"
//    All branches have translatable content → nested Branch recursion
// ===================================================================

describe('ternary: 3-level deep nesting → recursive Branch', () => {
  ruleTester.run('deeply-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b, c }) {
            return <T>{a ? "x" : b ? "y" : c ? "z" : "w"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b, c }) {
            return <T><Branch branch={a} true="x"><Branch branch={b} true="y"><Branch branch={c} true="z">w</Branch></Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Complex test expression: obj.prop === "val" ? "a" : "b"
//    Should extract obj.prop as the branch expression
// ===================================================================

describe('ternary: member expression in test with equality → Branch with obj.prop', () => {
  ruleTester.run('member-expression-test-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ obj }) {
            return <T>{obj.prop === "val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ obj }) {
            return <T><Branch branch={obj.prop} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Method call in test: getStatus() === "active" ? "on" : "off"
//    Should extract getStatus() as branch expression
// ===================================================================

describe('ternary: method call in test with equality → Branch with getStatus()', () => {
  ruleTester.run('method-call-test-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{getStatus() === "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component() {
            return <T><Branch branch={getStatus()} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Comparison value is a number: x === 42 ? "a" : "b"
//    42 fails VALID_JSX_PROP_NAME (starts with digit) → falls back to true
// ===================================================================

describe('ternary: numeric comparison value → falls back to true prop', () => {
  ruleTester.run('numeric-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === 42 ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === 42} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Comparison value with hyphens: x === "hello-world" ? "a" : "b"
//     "hello-world" matches VALID_JSX_PROP_NAME (hyphens allowed) → prop name
// ===================================================================

describe('ternary: hyphenated comparison value → valid prop name', () => {
  ruleTester.run('hyphenated-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "hello-world" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} hello-world="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Comparison value is empty string: x === "" ? "a" : "b"
//     "" fails VALID_JSX_PROP_NAME (empty) → falls back to true
// ===================================================================

describe('ternary: empty string comparison value → falls back to true prop', () => {
  ruleTester.run('empty-string-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === ""} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Comparison value starts with digit: x === "3px" ? "a" : "b"
//     "3px" fails VALID_JSX_PROP_NAME (starts with digit) → falls back to true
// ===================================================================

describe('ternary: digit-starting comparison value → falls back to true prop', () => {
  ruleTester.run('digit-starting-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "3px" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "3px"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Loose equality ==: x == "val" ? "a" : "b"
//     == is handled same as === (no swap)
// ===================================================================

describe('ternary: loose equality == → Branch with prop name', () => {
  ruleTester.run('loose-equality-operator', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x == "val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Loose inequality !=: x != "val" ? "a" : "b"
//     != triggers swap (same as !==)
// ===================================================================

describe('ternary: loose inequality != → Branch with swapped branches', () => {
  ruleTester.run('loose-inequality-operator', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x != "val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. Double negation: !!cond ? "yes" : "no"
//     extractBranchInfo recursively unwraps ! → swap, then ! → swap again
//     Two swaps cancel out → no net swap
// ===================================================================

describe('ternary: double negation !! → swaps cancel out', () => {
  ruleTester.run('double-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{!!cond ? "yes" : "no"}</T>;
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

// ===================================================================
// 16. One branch is empty string literal → Branch
//     Empty string IS a string literal → hasTranslatableContent = true
// ===================================================================

describe('ternary: empty string branch → Branch (empty string is translatable)', () => {
  ruleTester.run('empty-string-branch', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "hello" : ""}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="hello"></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 17. Ternary inside surrounding text
//     <T>Hello {cond ? "world" : "there"} bye</T>
// ===================================================================

describe('ternary: inside surrounding text → Branch inline', () => {
  ruleTester.run('ternary-inside-text', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>Hello {cond ? "world" : "there"} bye</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T>Hello <Branch branch={cond} true="world">there</Branch> bye</T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 18. Multiple ternaries in same T
//     <T>{a ? "x" : "y"}{b ? "m" : "n"}</T>
//     Two separate errors, both fixed
// ===================================================================

describe('ternary: multiple ternaries in same T → two errors', () => {
  ruleTester.run('multiple-ternaries', staticJsx, {
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
// 19. Ternary where consequent is JSX with attributes
//     cond ? <a href="/">Home</a> : "Away"
// ===================================================================

describe('ternary: JSX consequent with attributes → Branch', () => {
  ruleTester.run('jsx-consequent-with-attributes', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? <a href="/">Home</a> : "Away"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={<a href="/">Home</a>}>Away</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 20. Ternary where both branches are JSX fragments
// ===================================================================

describe('ternary: both branches JSX fragments → Branch', () => {
  ruleTester.run('both-jsx-fragment-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? <>hello</> : <>world</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={<>hello</>}><>world</></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 21. Ternary with undefined alternate
//     undefined is an Identifier → not translatable
//     But consequent "yes" is translatable → Branch
//     formatAsChildren for undefined (Identifier) → {undefined}
// ===================================================================

describe('ternary: undefined alternate → Branch with {undefined} children', () => {
  ruleTester.run('undefined-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : undefined}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes">{undefined}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes"><Var>{undefined}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 22. Comparison with boolean literal true: x === true ? "yes" : "no"
//     String(true) = "true" → VALID_JSX_PROP_NAME matches → prop name "true"
// ===================================================================

describe('ternary: comparison with boolean true literal → prop name "true"', () => {
  ruleTester.run('comparison-boolean-true', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === true ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 23. Comparison with boolean literal false: x === false ? "off" : "on"
//     String(false) = "false" → VALID_JSX_PROP_NAME matches → prop name "false"
// ===================================================================

describe('ternary: comparison with boolean false literal → prop name "false"', () => {
  ruleTester.run('comparison-boolean-false', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === false ? "off" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} false="off">on</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 24. Member expression without comparison: obj.isActive ? "active" : "inactive"
//     No binary expression → falls through to default → branchExpr = obj.isActive, propName = "true"
// ===================================================================

describe('ternary: member expression test without comparison → true prop', () => {
  ruleTester.run('member-expression-test-no-comparison', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ obj }) {
            return <T>{obj.isActive ? "active" : "inactive"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ obj }) {
            return <T><Branch branch={obj.isActive} true="active">inactive</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Additional edge cases beyond the original 24
// ===================================================================

// 25. Ternary where consequent is string but alternate is identifier
//     One branch translatable → Branch, but alternate {someVar} triggers re-lint → Var

describe('ternary: string consequent, identifier alternate → Branch then Var', () => {
  ruleTester.run('string-consequent-identifier-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, label }) {
            return <T>{cond ? "hello" : label}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ cond, label }) {
            return <T><Branch branch={cond} true="hello">{label}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond, label }) {
            return <T><Branch branch={cond} true="hello"><Var>{label}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// 26. Triple negation: !!!cond ? "a" : "b"
//     Three swaps → net swap = true (odd number of negations)

describe('ternary: triple negation !!! → odd swaps → net swap', () => {
  ruleTester.run('triple-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{!!!cond ? "no" : "yes"}</T>;
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

// 27. Negated inequality: !(x !== "val") ? "a" : "b"
//     ! swaps, !== swaps → double swap → no net swap → prop name "val"

describe('ternary: negated inequality !(x !== "val") → double swap cancels', () => {
  ruleTester.run('negated-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!(x !== "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 28. Comparison with null literal: x === null ? "gone" : "here"
//     null is a Literal with value null → literal.value != null check fails
//     → falls through to default → branchExpr = whole expression, propName = "true"

describe('ternary: comparison with null → falls back to true prop', () => {
  ruleTester.run('comparison-with-null', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === null ? "gone" : "here"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === null} true="gone">here</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 29. Ternary with string consequent and null alternate → self-closing Branch
//     null alternate → formatAsChildren returns null → self-closing tag

describe('ternary: string consequent, null alternate → self-closing Branch', () => {
  ruleTester.run('string-consequent-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "visible" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="visible" /></T>;
          }
        `,
      },
    ],
  });
});

// 30. Negated ternary with null: !cond ? "no" : null
//     ! flips → consequent becomes null (original alternate), alternate becomes "no" (original consequent)
//     null consequent → self-closing? No: swap means consequent is null and alternate is "no"
//     After swap: propValue = formatAsPropValue(null) and children = formatAsChildren("no")
//     Wait, swap means: consequent = swap ? expr.alternate : expr.consequent = expr.alternate = null
//                        alternate  = swap ? expr.consequent : expr.alternate = expr.consequent = "no"
//     propValue(null) → null is not a string, not branchable → {null}
//     children("no") → staticStringValue → "no"
//     So: <Branch branch={cond} true={null}>no</Branch>

describe('ternary: negated with null alternate → swapped Branch', () => {
  ruleTester.run('negated-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{!cond ? "no" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={null}>no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 31. Ternary with JSX element consequent and null alternate → self-closing Branch

describe('ternary: JSX consequent, null alternate → self-closing Branch', () => {
  ruleTester.run('jsx-consequent-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? <b>bold</b> : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true={<b>bold</b>} /></T>;
          }
        `,
      },
    ],
  });
});

// 32. Ternary with static template literal (no interpolation) in both branches

describe('ternary: both branches static template literals → Branch', () => {
  ruleTester.run('both-template-literal-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? \`yes\` : \`no\`}</T>;
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

// 33. Comparison value with underscore: x === "my_val" ? "a" : "b"
//     Underscores are valid in JSX prop names

describe('ternary: underscore in comparison value → valid prop name', () => {
  ruleTester.run('underscore-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "my_val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} my_val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 34. Comparison value starting with $: x === "$price" ? "a" : "b"
//     $ is valid start char per VALID_JSX_PROP_NAME

describe('ternary: dollar-sign-starting comparison value → valid prop name', () => {
  ruleTester.run('dollar-sign-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "$price" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} $price="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 35. Comparison value with spaces: x === "hello world" ? "a" : "b"
//     Spaces fail VALID_JSX_PROP_NAME → falls back to true

describe('ternary: space in comparison value → falls back to true prop', () => {
  ruleTester.run('space-in-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "hello world" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "hello world"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 36. Ternary where consequent is a number and alternate is null → Var
//     Neither number nor null is translatable → isBranchableConditional = false

describe('ternary: number consequent, null alternate → Var', () => {
  ruleTester.run('number-consequent-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? 42 : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ cond }) {
            return <T><Var>{cond ? 42 : null}</Var></T>;
          }
        `,
      },
    ],
  });
});

// 37. Ternary where only alternate is string → Branch
//     consequent is identifier (not translatable), alternate is string → one branch translatable

describe('ternary: identifier consequent, string alternate → Branch', () => {
  ruleTester.run('identifier-consequent-string-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, val }) {
            return <T>{cond ? val : "fallback"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function Component({ cond, val }) {
            return <T><Branch branch={cond} true={val}>fallback</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond, val }) {
            return <T><Branch branch={cond} true=<Var>{val}</Var>>fallback</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// 38. Ternary inside JSX element inside T
//     <T><span>{cond ? "a" : "b"}</span></T>
//     The ternary is inside a span which is inside T → still in translatable context

describe('ternary: inside nested JSX element within T → Branch', () => {
  ruleTester.run('ternary-inside-nested-jsx', staticJsx, {
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

// 39. Computed member expression in test: arr[0] === "val" ? "a" : "b"

describe('ternary: computed member expression in equality test → Branch', () => {
  ruleTester.run('computed-member-expression-test', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ arr }) {
            return <T>{arr[0] === "val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ arr }) {
            return <T><Branch branch={arr[0]} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 40. Reversed comparison with string on left: "val" === x ? "a" : "b"
//     extractBranchInfo tries both sides → finds "val" as literal on left

describe('ternary: reversed comparison (literal on left) → extracts prop name', () => {
  ruleTester.run('reversed-comparison-literal-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{"val" === x ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 41. Ternary with string consequent and JSX fragment alternate

describe('ternary: string consequent, JSX fragment alternate → Branch', () => {
  ruleTester.run('string-consequent-jsx-fragment-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "text" : <>fragment</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="text"><>fragment</></Branch></T>;
          }
        `,
      },
    ],
  });
});

// 42. Ternary with equality comparison and self-closing JSX

describe('ternary: equality with self-closing JSX consequent → Branch', () => {
  ruleTester.run('equality-self-closing-jsx-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status === "loading" ? <br /> : "done"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} loading={<br />}>done</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 43. Ternary where consequent is a nested ternary but alternate is not

describe('ternary: nested ternary in consequent only → Branch with nested Branch in prop', () => {
  ruleTester.run('nested-ternary-in-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a ? (b ? "x" : "y") : "z"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} true={<Branch branch={b} true="x">y</Branch>}>z</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 44. Ternary where both branches have the same string value
//     Still a ConditionalExpression with translatable content → Branch

describe('ternary: both branches identical strings → Branch', () => {
  ruleTester.run('identical-string-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "same" : "same"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="same">same</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 45. Ternary with comparison value containing dots: x === "v1.0" ? "old" : "new"
//     "v1.0" - dots fail VALID_JSX_PROP_NAME regex (dots not in [a-zA-Z0-9_$-])

describe('ternary: dot in comparison value → falls back to true prop', () => {
  ruleTester.run('dot-in-comparison-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "v1.0" ? "old" : "new"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "v1.0"} true="old">new</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 46. Negated equality: !(x === "val") ? "a" : "b"
//     ! swaps, === doesn't swap → net swap

describe('ternary: negated equality !(x === "val") → swap', () => {
  ruleTester.run('negated-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!(x === "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 47. Ternary with string in both branches containing special characters (quotes)
//     Strings with double quotes inside need escaping

describe('ternary: string branches with apostrophes → Branch', () => {
  ruleTester.run('string-branches-with-apostrophes', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "it's" : "they're"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="it's">they're</Branch></T>;
          }
        `,
      },
    ],
  });
});

// 48. Reversed inequality: "val" !== x ? "a" : "b"
//     !== triggers swap, literal on left side → extractBranchInfo finds it

describe('ternary: reversed inequality ("val" !== x) → swap and extract prop', () => {
  ruleTester.run('reversed-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{"val" !== x ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});
