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
// 1. Existing var0 in options — skips to var1
// ===================================================================

describe('collision: existing var0 in options skips to var1', () => {
  ruleTester.run('var-collision-skip-var0', staticString, {
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

// ===================================================================
// 2. Existing var0 AND var1 — uses var2 and var3
// ===================================================================

describe('collision: existing var0 and var1 skips to var2 and var3', () => {
  ruleTester.run('var-collision-skip-var0-var1', staticString, {
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

// ===================================================================
// 3. Gap in existing vars — var1 reserved, var0 is free
// ===================================================================

describe('collision: gap in reserved vars — var0 is free when only var1 is reserved', () => {
  ruleTester.run('var-collision-gap', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { var1: existing });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var0}", { var1: existing, var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Existing var0 with sugar var — skips var0, uses var1
// ===================================================================

describe('collision: existing var0 with sugar var skips to var1', () => {
  ruleTester.run('var-collision-sugar-plus-var0', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $context: "ctx", var0: x });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var1}", { $context: "ctx", var0: x, var1: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Same expression twice — reuses var0, single option entry
// ===================================================================

describe('collision: same expression twice reuses var0', () => {
  ruleTester.run('var-dedup-same-twice', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(name + " and " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} and {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Same expression three times — reuses var0
// ===================================================================

describe('collision: same expression three times reuses var0', () => {
  ruleTester.run('var-dedup-same-thrice', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(x + " " + x + " " + x);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} {var0} {var0}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Same member expression — reuses var0
// ===================================================================

describe('collision: same member expression reuses var0', () => {
  ruleTester.run('var-dedup-member-expr', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(user.name + " aka " + user.name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} aka {var0}", { var0: user.name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Different expressions — var0 and var1 (not reused)
// ===================================================================

describe('collision: different expressions get different var names', () => {
  ruleTester.run('var-no-dedup-different', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(a + " " + b);
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

// ===================================================================
// 9. Same expression in template literal — reuses var0
// ===================================================================

describe('collision: same expression in template literal reuses var0', () => {
  ruleTester.run('var-dedup-template-literal', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(\`\${name} and \${name}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0} and {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Collision with many reserved — var3, var4, var5
// ===================================================================

describe('collision: many reserved vars skips to var3, var4, var5', () => {
  ruleTester.run('var-collision-many-reserved', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(a + " " + b + " " + c, { var0: x, var1: y, var2: z });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var3} {var4} {var5}", { var0: x, var1: y, var2: z, var3: a, var4: b, var5: c });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Ternary select variable reuse with dynamic part
// ===================================================================

// The select uses x as its variable (source text "x"),
// and the second dynamic part is also x (source text "x"),
// so resolveVarName should deduplicate them to the same var0.
describe('collision: ternary select variable reused for same dynamic expression', () => {
  ruleTester.run('var-dedup-select-and-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a" ? "A" : "B") + " " + x);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, a {A} other {B}} {var0}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. No existing options (no second argument) — var0 with no collision
// ===================================================================

describe('collision: no existing options — var0 with no collision concerns', () => {
  ruleTester.run('var-no-options-arg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name);
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
