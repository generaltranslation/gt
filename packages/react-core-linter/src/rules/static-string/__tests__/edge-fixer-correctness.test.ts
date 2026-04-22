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
// 1. Complex realistic: multiple vars with static text between
// ===================================================================

// gt("Welcome, " + user.name + "! You have " + count + " new messages.")
// → gt("Welcome, {var0}! You have {var1} new messages.", { var0: user.name, var1: count })
describe('fixer-correctness: complex realistic multi-var concat', () => {
  ruleTester.run('complex-realistic-concat', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Welcome, " + user.name + "! You have " + count + " new messages.");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Welcome, {var0}! You have {var1} new messages.", { var0: user.name, var1: count });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Ternary + var: select with trailing dynamic variable
// ===================================================================

// gt("Dear " + (gender === "male" ? "Mr." : "Ms.") + " " + lastName)
// → gt("Dear {var0, select, male {Mr.} other {Ms.}} {var1}", { var0: gender, var1: lastName })
describe('fixer-correctness: ternary equality select + trailing var', () => {
  ruleTester.run('ternary-plus-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Dear " + (gender === "male" ? "Mr." : "Ms.") + " " + lastName);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Dear {var0, select, male {Mr.} other {Ms.}} {var1}", { var0: gender, var1: lastName });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Template literal with multiple types: var, var, and boolean select
// ===================================================================

// gt(`${greeting}, ${name}! Status: ${active ? "active" : "inactive"}`)
// → gt("{var0}, {var1}! Status: {var2, select, true {active} other {inactive}}", { var0: greeting, var1: name, var2: active })
describe('fixer-correctness: template literal with vars and boolean select', () => {
  ruleTester.run('template-multi-types', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(\`\${greeting}, \${name}! Status: \${active ? "active" : "inactive"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0}, {var1}! Status: {var2, select, true {active} other {inactive}}", { var0: greeting, var1: name, var2: active });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Chained select with same variable + trailing dynamic var
// ===================================================================

// gt("" + (lang === "en" ? "Hello" : lang === "es" ? "Hola" : "Hi") + " " + name)
// → gt("{var0, select, en {Hello} es {Hola} other {Hi}} {var1}", { var0: lang, var1: name })
describe('fixer-correctness: chained same-var select + trailing var', () => {
  ruleTester.run('chained-select-plus-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (lang === "en" ? "Hello" : lang === "es" ? "Hola" : "Hi") + " " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, en {Hello} es {Hola} other {Hi}} {var1}", { var0: lang, var1: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Nested select: different variables break the chain
// ===================================================================

// gt("" + (a === "x" ? "X" : b === "y" ? "Y" : "Z") + "!")
// a chain: {x: X}, then b breaks → nested select, followed by static "!"
// → gt("{var0, select, x {X} other {{var1, select, y {Y} other {Z}}}}!", { var0: a, var1: b })
describe('fixer-correctness: nested select with trailing static', () => {
  ruleTester.run('nested-select-trailing-static', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (a === "x" ? "X" : b === "y" ? "Y" : "Z") + "!");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, x {X} other {{var1, select, y {Y} other {Z}}}}!", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Same var reused with static between — var deduplication
// ===================================================================

// gt(name + " loves " + name)
// name appears twice → resolveVarName deduplicates, single var0 option
// → gt("{var0} loves {var0}", { var0: name })
describe('fixer-correctness: same var reused — deduplication', () => {
  ruleTester.run('var-reuse-dedup', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(name + " loves " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} loves {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. msg() with boolean ternary
// ===================================================================

// msg("Status: " + (online ? "Online" : "Offline"))
// → msg("Status: {var0, select, true {Online} other {Offline}}", { var0: online })
describe('fixer-correctness: msg() with boolean ternary select', () => {
  ruleTester.run('msg-ternary-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const label = msg("Status: " + (online ? "Online" : "Offline"));
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg } from 'gt-react';
          const label = msg("Status: {var0, select, true {Online} other {Offline}}", { var0: online });
        `,
      },
    ],
  });
});

// ===================================================================
// 8. getGT with template literal (gt-next server component pattern)
// ===================================================================

// const gt = await getGT(); gt(`Hello ${name}`)
// → gt("Hello {var0}", { var0: name })
describe('fixer-correctness: getGT template literal', () => {
  ruleTester.run('getgt-template-literal', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt(\`Hello \${name}\`);
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Existing options preserved — sugar vars kept, ICU vars merged
// ===================================================================

// gt("Hi " + name, { $context: "informal", $id: "greeting" })
// → gt("Hi {var0}", { $context: "informal", $id: "greeting", var0: name })
describe('fixer-correctness: existing sugar options preserved during merge', () => {
  ruleTester.run('existing-options-preserved', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hi " + name, { $context: "informal", $id: "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hi {var0}", { $context: "informal", $id: "greeting", var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Empty string parts — only vars produce ICU placeholders
// ===================================================================

// gt("" + name + "" + suffix + "")
// Empty static strings produce no ICU text, vars are adjacent
// → gt("{var0}{var1}", { var0: name, var1: suffix })
describe('fixer-correctness: empty string parts collapse', () => {
  ruleTester.run('empty-string-parts', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + name + "" + suffix + "");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0}{var1}", { var0: name, var1: suffix });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Very long expression — 5 dynamic variables
// ===================================================================

// gt(a + " " + b + " " + c + " " + d + " " + e)
// → gt("{var0} {var1} {var2} {var3} {var4}", { var0: a, var1: b, var2: c, var3: d, var4: e })
describe('fixer-correctness: 5 dynamic variables', () => {
  ruleTester.run('five-vars', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(a + " " + b + " " + c + " " + d + " " + e);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} {var1} {var2} {var3} {var4}", { var0: a, var1: b, var2: c, var3: d, var4: e });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Select with var reuse — same var x in two separate selects
// ===================================================================

// gt("" + (x === "a" ? "A" : "B") + " and " + (x === "c" ? "C" : "D"))
// Two independent selects both using x → resolveVarName reuses var0
// → gt("{var0, select, a {A} other {B}} and {var0, select, c {C} other {D}}", { var0: x })
describe('fixer-correctness: same var x reused in two separate selects', () => {
  ruleTester.run('select-var-reuse', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : "B") + " and " + (x === "c" ? "C" : "D"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {B}} and {var0, select, c {C} other {D}}", { var0: x });
          }
        `,
      },
    ],
  });
});
