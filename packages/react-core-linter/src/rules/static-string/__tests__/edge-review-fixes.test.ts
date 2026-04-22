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
// 1. Select key with spaces — falls back to plain variable
// ===================================================================

// gt("val: " + (x === "hello world" ? "A" : "B"))
// → gt("val: {var0}", { var0: x === "hello world" ? "A" : "B" })
// Space in the compared literal makes it invalid as an ICU select key,
// so extractSelectInfo falls through to the boolean path, but the boolean
// path uses the full test expression as the variable. Since the consequent
// and alternate are static, tryBuildSelect still produces a select with key "true".
describe('review: select key with spaces falls back to boolean key', () => {
  ruleTester.run('select-key-spaces', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("val: " + (x === "hello world" ? "A" : "B"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("val: {var0, select, true {A} other {B}}", { var0: x === "hello world" });
          }
        `,
      },
    ],
  });
});

// gt("" + (x === "a b" ? "A" : x === "c" ? "C" : "D"))
// Space in first key breaks chain — falls back to boolean for first,
// then "c" is a different variable text, so nested select
describe('review: chained ternary where first key has spaces', () => {
  ruleTester.run('select-key-spaces-chain', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a b" ? "A" : x === "c" ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, true {A} other {{var1, select, c {C} other {D}}}}", { var0: x === "a b", var1: x });
          }
        `,
      },
    ],
  });
});

// Valid select keys (no spaces) still work
describe('review: select key without spaces works normally', () => {
  ruleTester.run('select-key-valid', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("val: " + (x === "admin" ? "A" : "B"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("val: {var0, select, admin {A} other {B}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Var name collision with existing option keys
// ===================================================================

// gt("Hello " + name, { var0: existing })
// → gt("Hello {var1}", { var0: existing, var1: name })
// var0 is taken, so the generated name skips to var1
describe('review: var name collision with existing option key', () => {
  ruleTester.run('var-collision', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { var0: existing });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var1}", { var0: existing, var1: name });
          }
        `,
      },
    ],
  });
});

// gt(a + " " + b, { var0: x, var1: y })
// → gt("{var2} {var3}", { var0: x, var1: y, var2: a, var3: b })
// Both var0 and var1 are taken
describe('review: multiple var name collisions skip correctly', () => {
  ruleTester.run('var-collision-multi', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(a + " " + b, { var0: x, var1: y });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var2} {var3}", { var0: x, var1: y, var2: a, var3: b });
          }
        `,
      },
    ],
  });
});

// gt("Hello " + name, { $context: "greeting" })
// No collision — $context is not a varN name
describe('review: sugar var keys do not collide with generated var names', () => {
  ruleTester.run('no-collision-sugar', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $context: "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var0}", { $context: "greeting", var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Empty options object — vars inserted correctly
// ===================================================================

// gt("Hello " + name, {})
// → gt("Hello {var0}", { var0: name })
// Empty object gets replaced entirely with the generated vars
describe('review: empty options object gets replaced with vars', () => {
  ruleTester.run('empty-options-obj', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, {});
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt(a + " " + b, {})
// → gt("{var0} {var1}", { var0: a, var1: b })
// Multiple vars into empty object
describe('review: multiple vars into empty options object', () => {
  ruleTester.run('empty-options-multi', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(a + " " + b, {});
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} {var1}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});

// gt(`Hello ${name}`, {})
// → gt("Hello {var0}", { var0: name })
// Template literal with empty options object
describe('review: template literal with empty options object', () => {
  ruleTester.run('empty-options-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(\`Hello \${name}\`, {});
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});
