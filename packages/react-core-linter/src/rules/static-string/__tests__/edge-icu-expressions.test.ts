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
// 1. Call expressions
// ===================================================================

// gt("val: " + foo())
// → gt("val: {var0}", { var0: foo() })
describe('edge-icu: call expression in concatenation', () => {
  ruleTester.run('call-expression', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + foo());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: foo() });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Computed member access
// ===================================================================

// gt("val: " + obj[key])
// → gt("val: {var0}", { var0: obj[key] })
describe('edge-icu: computed member access in concatenation', () => {
  ruleTester.run('computed-member', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + obj[key]);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: obj[key] });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Parenthesized arithmetic expression
//    NOTE: The linter cannot distinguish arithmetic + from string +,
//    so (a + b) is flattened into two separate dynamic parts.
// ===================================================================

// gt("val: " + (a + b))
// → gt("val: {var0}{var1}", { var0: a, var1: b })
describe('edge-icu: parenthesized arithmetic expression flattened', () => {
  ruleTester.run('paren-arithmetic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (a + b));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}{var1}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Unary expression (negation)
// ===================================================================

// gt("count: " + (-count))
// → gt("count: {var0}", { var0: -count })
describe('edge-icu: unary negation in concatenation', () => {
  ruleTester.run('unary-negation', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("count: " + (-count));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("count: {var0}", { var0: -count });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Typeof expression
// ===================================================================

// gt("type: " + typeof value)
// → gt("type: {var0}", { var0: typeof value })
describe('edge-icu: typeof expression in concatenation', () => {
  ruleTester.run('typeof-expr', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("type: " + typeof value);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("type: {var0}", { var0: typeof value });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Void expression
// ===================================================================

// gt("val: " + void 0)
// → gt("val: {var0}", { var0: void 0 })
describe('edge-icu: void expression in concatenation', () => {
  ruleTester.run('void-expr', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + void 0);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: void 0 });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Conditional with null alternate
//    null is not a static string, so tryBuildSelect fails and the
//    whole ternary becomes a plain dynamic variable.
// ===================================================================

// gt("val: " + (cond ? "yes" : null))
// → gt("val: {var0}", { var0: cond ? "yes" : null })
describe('edge-icu: ternary with null alternate is plain variable', () => {
  ruleTester.run('ternary-null-alternate', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (cond ? "yes" : null));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: cond ? "yes" : null });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Numeric literal in concat
//    Number literals are not static strings, so they become dynamic.
// ===================================================================

// gt("count: " + 42)
// → gt("count: {var0}", { var0: 42 })
describe('edge-icu: numeric literal treated as dynamic', () => {
  ruleTester.run('numeric-literal', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("count: " + 42);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("count: {var0}", { var0: 42 });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Boolean literal in concat
//    Boolean literals are not static strings, so they become dynamic.
// ===================================================================

// gt("flag: " + true)
// → gt("flag: {var0}", { var0: true })
describe('edge-icu: boolean literal treated as dynamic', () => {
  ruleTester.run('boolean-literal', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("flag: " + true);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("flag: {var0}", { var0: true });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. new expression
// ===================================================================

// gt("val: " + new Date())
// → gt("val: {var0}", { var0: new Date() })
describe('edge-icu: new expression in concatenation', () => {
  ruleTester.run('new-expression', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + new Date());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: new Date() });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Arrow function IIFE result
// ===================================================================

// gt("val: " + (() => "hi")())
// → gt("val: {var0}", { var0: (() => "hi")() })
describe('edge-icu: arrow function IIFE in concatenation', () => {
  ruleTester.run('arrow-iife', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + (() => "hi")());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: (() => "hi")() });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Optional chaining
// ===================================================================

// gt("name: " + user?.name)
// → gt("name: {var0}", { var0: user?.name })
describe('edge-icu: optional chaining in concatenation', () => {
  ruleTester.run('optional-chaining', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("name: " + user?.name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("name: {var0}", { var0: user?.name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Nullish coalescing
//     ?? is a LogicalExpression, not a ConditionalExpression,
//     so it becomes a plain dynamic variable.
// ===================================================================

// gt("name: " + (name ?? "default"))
// → gt("name: {var0}", { var0: name ?? "default" })
describe('edge-icu: nullish coalescing in concatenation', () => {
  ruleTester.run('nullish-coalescing', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("name: " + (name ?? "default"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("name: {var0}", { var0: name ?? "default" });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Tagged template in concat
// ===================================================================

// gt("val: " + tag`hello`)
// → gt("val: {var0}", { var0: tag`hello` })
describe('edge-icu: tagged template in concatenation', () => {
  ruleTester.run('tagged-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: " + tag\`hello\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: tag\`hello\` });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. Deeply nested concatenation (7 parts, 3 dynamic)
// ===================================================================

// gt("a" + b + "c" + d + "e" + f + "g")
// → gt("a{var0}c{var1}e{var2}g", { var0: b, var1: d, var2: f })
describe('edge-icu: deeply nested concatenation with interleaved static/dynamic', () => {
  ruleTester.run('deep-concat', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("a" + b + "c" + d + "e" + f + "g");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("a{var0}c{var1}e{var2}g", { var0: b, var1: d, var2: f });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 16. Template literal with 4+ expressions
// ===================================================================

// gt(`${a} ${b} ${c} ${d}`)
// → gt("{var0} {var1} {var2} {var3}", { var0: a, var1: b, var2: c, var3: d })
describe('edge-icu: template literal with 4 expressions', () => {
  ruleTester.run('template-four-exprs', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${a} \${b} \${c} \${d}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} {var1} {var2} {var3}", { var0: a, var1: b, var2: c, var3: d });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 17. Empty string parts in concat
//     Empty strings are preserved in the ICU output.
// ===================================================================

// gt("" + name + "")
// → gt("{var0}", { var0: name })
describe('edge-icu: empty string parts in concatenation', () => {
  ruleTester.run('empty-string-parts', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("" + name + "");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 18. Single quotes (apostrophe) in static text
// ===================================================================

// gt("it's " + name)
// → gt("it's {var0}", { var0: name })
describe('edge-icu: apostrophe in static text preserved', () => {
  ruleTester.run('apostrophe-static', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("it's " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("it's {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 19. Same expression reuses variable name
// ===================================================================

// gt(a + " blah " + a)
// → gt("{var0} blah {var0}", { var0: a })
describe('edge-icu: same variable in concat reuses ICU var name', () => {
  ruleTester.run('reuse-var-concat', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(a + " blah " + a);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} blah {var0}", { var0: a });
          }
        `,
      },
    ],
  });
});

// gt(`${name} and ${name}`)
// → gt("{var0} and {var0}", { var0: name })
describe('edge-icu: same variable in template literal reuses ICU var name', () => {
  ruleTester.run('reuse-var-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${name} and \${name}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} and {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt(a + " " + b + " " + a + " " + b)
// → gt("{var0} {var1} {var0} {var1}", { var0: a, var1: b })
describe('edge-icu: multiple repeated variables reuse names correctly', () => {
  ruleTester.run('reuse-var-multiple', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(a + " " + b + " " + a + " " + b);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} {var1} {var0} {var1}", { var0: a, var1: b });
          }
        `,
      },
    ],
  });
});
