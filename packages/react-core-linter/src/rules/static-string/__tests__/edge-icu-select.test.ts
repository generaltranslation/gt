import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
import { staticString } from '../index.js';

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
// 1. Ternary with loose equality (==) still extracts select key
// ===================================================================

// gt("val: " + (x == "a" ? "A" : "B"))
// → gt("val: {var0, select, a {A} other {B}}", { var0: x })
describe('edge-icu-select: loose equality (==) extracts select key', () => {
  ruleTester.run('loose-equality-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (x == "a" ? "A" : "B"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, a {A} other {B}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Reversed equality: literal on the left side
// ===================================================================

// gt("val: " + ("admin" === role ? "Admin" : "User"))
// → gt("val: {var0, select, admin {Admin} other {User}}", { var0: role })
describe('edge-icu-select: reversed equality (literal on left) extracts select key', () => {
  ruleTester.run('reversed-equality-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + ("admin" === role ? "Admin" : "User"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, admin {Admin} other {User}}", { var0: role });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Numeric comparison: numeric literal is not string, falls back to true key
// ===================================================================

// gt("val: " + (x === 1 ? "one" : "other"))
// → gt("val: {var0, select, true {one} other {other}}", { var0: x === 1 })
describe('edge-icu-select: numeric comparison falls back to boolean select', () => {
  ruleTester.run('numeric-comparison-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (x === 1 ? "one" : "other"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, true {one} other {other}}", { var0: x === 1 });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Negated condition: negation is not equality, becomes boolean select
// ===================================================================

// gt("val: " + (!cond ? "no" : "yes"))
// → gt("val: {var0, select, true {no} other {yes}}", { var0: !cond })
describe('edge-icu-select: negated condition becomes boolean select', () => {
  ruleTester.run('negated-condition-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (!cond ? "no" : "yes"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, true {no} other {yes}}", { var0: !cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Ternary with dynamic consequent: can't make select, plain var
// ===================================================================

// gt("val: " + (cond ? getName() : "default"))
// → gt("val: {var0}", { var0: cond ? getName() : "default" })
describe('edge-icu-select: dynamic consequent prevents select, becomes plain var', () => {
  ruleTester.run('dynamic-consequent', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (cond ? getName() : "default"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: cond ? getName() : "default" });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Ternary with dynamic alternate: can't make select, plain var
// ===================================================================

// gt("val: " + (cond ? "yes" : getNo()))
// → gt("val: {var0}", { var0: cond ? "yes" : getNo() })
describe('edge-icu-select: dynamic alternate prevents select, becomes plain var', () => {
  ruleTester.run('dynamic-alternate', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (cond ? "yes" : getNo()));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: cond ? "yes" : getNo() });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Deeply chained ternary (4 levels)
// ===================================================================

// gt("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : "D"))
// → gt("{var0, select, a {A} b {B} c {C} other {D}}", { var0: s })
describe('edge-icu-select: deeply chained ternary (4 levels) collapses into multi-branch select', () => {
  ruleTester.run('deep-chained-ternary', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} b {B} c {C} other {D}}", { var0: s });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Chained ternary where middle branch has dynamic consequent
// ===================================================================

// gt("" + (s === "a" ? "A" : s === "b" ? getB() : "C"))
// → gt("{var0}", { var0: s === "a" ? "A" : s === "b" ? getB() : "C" })
// Chain stops because inner consequent is dynamic; tail is not static string, so tryBuildSelect returns null
describe('edge-icu-select: chained ternary with dynamic middle branch becomes plain var', () => {
  ruleTester.run('chained-dynamic-middle', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (s === "a" ? "A" : s === "b" ? getB() : "C"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0}", { var0: s === "a" ? "A" : s === "b" ? getB() : "C" });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Ternary inside template literal
// ===================================================================

// gt(`val: ${x === "a" ? "A" : "B"}`)
// → gt("val: {var0, select, a {A} other {B}}", { var0: x })
describe('edge-icu-select: ternary inside template literal produces select', () => {
  ruleTester.run('template-ternary-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`val: \${x === "a" ? "A" : "B"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, a {A} other {B}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Multiple ternaries in one expression: two separate selects
// ===================================================================

// gt("" + (a ? "x" : "y") + " " + (b ? "p" : "q"))
// → gt("{var0, select, true {x} other {y}} {var1, select, true {p} other {q}}", { var0: a, var1: b })
describe('edge-icu-select: multiple ternaries produce separate selects with var0 and var1', () => {
  ruleTester.run('multiple-ternaries', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (a ? "x" : "y") + " " + (b ? "p" : "q"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, true {x} other {y}} {var1, select, true {p} other {q}}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Ternary with empty string branches
// ===================================================================

// gt("prefix" + (cond ? "" : "suffix"))
// → gt("prefix{var0, select, true {} other {suffix}}", { var0: cond })
describe('edge-icu-select: empty string branch is still static and produces select', () => {
  ruleTester.run('empty-string-branch', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("prefix" + (cond ? "" : "suffix"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("prefix{var0, select, true {} other {suffix}}", { var0: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Chained ternary with different variable at end breaks chain
// ===================================================================

// gt("" + (x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D"))
// → gt("{var0}", { var0: x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D" })
// Different variable (cond vs x) breaks chain; tail is a ConditionalExpression (not static), so tryBuildSelect returns null
describe('edge-icu-select: chained ternary with different variable at end becomes plain var', () => {
  ruleTester.run('chained-different-var-end', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0}", { var0: x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D" });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Template literal with ternary at start
// ===================================================================

// gt(`${cond ? "Hello" : "Hi"} world`)
// → gt("{var0, select, true {Hello} other {Hi}} world", { var0: cond })
describe('edge-icu-select: template literal with ternary at start', () => {
  ruleTester.run('template-ternary-start', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${cond ? "Hello" : "Hi"} world\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, true {Hello} other {Hi}} world", { var0: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Template literal with ternary at end
// ===================================================================

// gt(`Hello ${cond ? "world" : "earth"}`)
// → gt("Hello {var0, select, true {world} other {earth}}", { var0: cond })
describe('edge-icu-select: template literal with ternary at end', () => {
  ruleTester.run('template-ternary-end', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Hello \${cond ? "world" : "earth"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0, select, true {world} other {earth}}", { var0: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. Ternary with template literal branches (no interpolation)
// ===================================================================

// gt("val: " + (cond ? `yes` : `no`))
// → gt("val: {var0, select, true {yes} other {no}}", { var0: cond })
// Template literals without interpolation are static strings
describe('edge-icu-select: template literal branches without interpolation are static', () => {
  ruleTester.run('template-literal-branches', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (cond ? \`yes\` : \`no\`));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0, select, true {yes} other {no}}", { var0: cond });
          }
        `,
      },
    ],
  });
});
