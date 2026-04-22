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
// 1. Triple nesting: three different variables
// ===================================================================

// gt("" + (a === "x" ? "X" : b === "y" ? "Y" : c === "z" ? "Z" : "other"))
// a chain breaks at b, b chain breaks at c → triple-nested selects
describe('edge-nested-selects: three different variables → triple-nested selects', () => {
  ruleTester.run('triple-nesting', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (a === "x" ? "X" : b === "y" ? "Y" : c === "z" ? "Z" : "other"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, x {X} other {{var1, select, y {Y} other {{var2, select, z {Z} other {other}}}}}}", { var0: a, var1: b, var2: c });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Same variable in outer and inner nested select (x, y breaks, then x again)
// ===================================================================

// gt("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"))
// x chain: {a: A}, then y breaks the chain → nested y select
// Inside y's other: x === "c" starts a new x select
// x appears in outer (var0) and in inner (should reuse var0)
describe('edge-nested-selects: same variable in outer and inner nested select → variable deduplication', () => {
  ruleTester.run('same-var-outer-inner', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {{var1, select, b {B} other {{var0, select, c {C} other {D}}}}}}", { var0: x, var1: y });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Boolean ternary nested inside equality chain
// ===================================================================

// gt("" + (x === "a" ? "A" : cond ? "B" : "C"))
// x chain: {a: A}, then cond breaks (boolean) → nested boolean select with key "true"
describe('edge-nested-selects: boolean ternary nested inside equality chain', () => {
  ruleTester.run('boolean-nested-in-equality', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : cond ? "B" : "C"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {{var1, select, true {B} other {C}}}}", { var0: x, var1: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Select + dynamic var in same expression
// ===================================================================

// gt("" + (x === "a" ? "A" : "B") + " " + name)
// select is var0, name is var1
describe('edge-nested-selects: select + dynamic var in same expression', () => {
  ruleTester.run('select-plus-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : "B") + " " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {B}} {var1}", { var0: x, var1: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Two separate selects in same concat
// ===================================================================

// gt("" + (a === "x" ? "X" : "Y") + " " + (b === "p" ? "P" : "Q"))
// Two independent selects: var0 for a, var1 for b
describe('edge-nested-selects: two separate selects in same concat', () => {
  ruleTester.run('two-independent-selects', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (a === "x" ? "X" : "Y") + " " + (b === "p" ? "P" : "Q"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, x {X} other {Y}} {var1, select, p {P} other {Q}}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Variable deduplication across selects (same variable, two separate selects)
// ===================================================================

// gt("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"))
// This is the same as test 2 — validates variable deduplication:
// outer x → var0, y → var1, inner x → reuses var0
// (Covered by test 2 above, included here as explicit dedup test)
describe('edge-nested-selects: variable deduplication — x reused in inner nested select', () => {
  ruleTester.run('var-dedup-nested', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {{var1, select, b {B} other {{var0, select, c {C} other {D}}}}}}", { var0: x, var1: y });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Long collapsed select: 5+ branches with same variable
// ===================================================================

// gt("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : s === "d" ? "D" : s === "e" ? "E" : "F"))
// All same variable s → single select with 5 branches + other
describe('edge-nested-selects: 5+ branches with same variable → long collapsed select', () => {
  ruleTester.run('long-collapsed-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : s === "d" ? "D" : s === "e" ? "E" : "F"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, a {A} b {B} c {C} d {D} e {E} other {F}}", { var0: s });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Select key that's a number string
// ===================================================================

// gt("" + (x === "1" ? "one" : "other"))
// "1" has no spaces → valid ICU key
describe('edge-nested-selects: number string as select key', () => {
  ruleTester.run('number-string-key', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "1" ? "one" : "other"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, 1 {one} other {other}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Select key with hyphen (valid ICU key)
// ===================================================================

// gt("" + (x === "en-US" ? "English" : "Other"))
// "en-US" has no spaces → valid ICU key
describe('edge-nested-selects: hyphenated select key', () => {
  ruleTester.run('hyphenated-key', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "en-US" ? "English" : "Other"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, en-US {English} other {Other}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Select key with underscore (valid ICU key)
// ===================================================================

// gt("" + (x === "my_key" ? "Value" : "Other"))
// "my_key" has no spaces → valid ICU key
describe('edge-nested-selects: underscore select key', () => {
  ruleTester.run('underscore-key', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + (x === "my_key" ? "Value" : "Other"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0, select, my_key {Value} other {Other}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Template literal with nested select (different variables)
// ===================================================================

// gt(`Result: ${a === "x" ? "X" : b === "y" ? "Y" : "Z"}`)
// a chain breaks at b → nested selects inside template literal
describe('edge-nested-selects: template literal with nested select', () => {
  ruleTester.run('template-nested-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Result: \${a === "x" ? "X" : b === "y" ? "Y" : "Z"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Result: {var0, select, x {X} other {{var1, select, y {Y} other {Z}}}}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});
