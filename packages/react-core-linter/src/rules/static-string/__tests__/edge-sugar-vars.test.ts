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
// Edge-case and boundary-condition tests for sugar variables
// ($context, $id, $format, $maxChars) in gt()/msg() calls.
// ===================================================================

// 1. $context with concatenation of two static strings — valid
// Both sides are string literals, isStaticOrDerive accepts this via BinaryExpression.
describe('edge: $context with static string concatenation is valid', () => {
  ruleTester.run('context-static-concat', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "formal " + "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 2. $context with template literal (no interpolation) — valid
// isStaticString recognizes TemplateLiteral with zero expressions.
describe('edge: $context with plain template literal is valid', () => {
  ruleTester.run('context-template-no-interp', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: \`greeting\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 3. $context with template literal WITH interpolation — error
// TemplateLiteral with expressions.length > 0 is not static.
describe('edge: $context with interpolated template literal is error', () => {
  ruleTester.run('context-template-with-interp', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const val = "world";
            return gt("Hello", { $context: \`ctx \${val}\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 4. $context with nested derive in concatenation — valid
// isStaticOrDerive recursively walks BinaryExpression(+) tree.
describe('edge: $context with nested derive in concat is valid', () => {
  ruleTester.run('context-nested-derive-concat', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "a" + derive(x) + "b" + derive(y) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 5. $id with concat of two static strings — error
// $id only allows static strings (isStaticString), NOT concatenation.
// BinaryExpression is not handled by isStaticString.
describe('edge: $id with static string concat is error (no concat support)', () => {
  ruleTester.run('id-static-concat-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: "hello" + "-world" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 6. $id with number — error
// $id requires a static string, not a number.
describe('edge: $id with number literal is error', () => {
  ruleTester.run('id-number-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: 42 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 7. $format with template literal (no interpolation) — valid
// isStaticString treats TemplateLiteral with zero expressions as static.
describe('edge: $format with plain template literal is valid', () => {
  ruleTester.run('format-template-no-interp', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: \`ICU\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 8. $format with boolean — error
// isStaticString returns false for boolean literals.
describe('edge: $format with boolean is error', () => {
  ruleTester.run('format-boolean-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: true });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 9. $maxChars with negative number — valid (reverses cutoff direction)
describe('edge: $maxChars with negative number is valid', () => {
  ruleTester.run('maxchars-negative-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: -5 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 10. $maxChars with float — valid
// 3.14 is a number Literal, and isStaticNumber only checks typeof === 'number'.
describe('edge: $maxChars with float is valid (linter allows, CLI validates)', () => {
  ruleTester.run('maxchars-float-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: 3.14 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 11. $maxChars with expression — error
// BinaryExpression 10 + 5 is not a Literal node.
describe('edge: $maxChars with arithmetic expression is error', () => {
  ruleTester.run('maxchars-expression-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: 10 + 5 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 12. $maxChars with template literal — error
// TemplateLiteral is not a number, so isStaticNumber returns false.
describe('edge: $maxChars with template literal is error (not a number)', () => {
  ruleTester.run('maxchars-template-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: \`50\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 13. Non-sugar key starting with $ — valid (ignored)
// $custom is not in SUGAR_VARIABLE_NAMES, so validateSugarVariables skips it.
describe('edge: non-sugar $-prefixed key is ignored', () => {
  ruleTester.run('non-sugar-dollar-key', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const dynamicValue = "test";
            return gt("Hello", { $custom: dynamicValue });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 14. Spread in options object — should not crash
// SpreadElement is not Property, so the loop skips it via the type check.
describe('edge: spread in options object does not crash', () => {
  ruleTester.run('spread-in-options', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const opts = { name: "world" };
            return gt("Hello {name}!", { ...opts });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 15. Computed property key — should not crash
// Property with computed key has key.type !== Identifier, so loop skips it.
describe('edge: computed property key does not crash', () => {
  ruleTester.run('computed-property-key', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const key = "name";
            return gt("Hello", { [key]: "value" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 16. Shorthand property — error
// { $context } is shorthand for { $context: $context }, where the value
// is an Identifier reference. isStaticOrDerive returns false for bare Identifiers.
describe('edge: shorthand sugar property is error (variable reference)', () => {
  ruleTester.run('shorthand-sugar', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const $context = "greeting";
            return gt("Hello", { $context });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 17. $context with declareStatic (deprecated alias) — valid
// isDeriveFunction checks for both 'derive' and 'declareStatic'.
describe('edge: $context with declareStatic is valid (deprecated alias)', () => {
  ruleTester.run('context-declare-static', staticString, {
    valid: [
      {
        code: `
          import { useGT, declareStatic } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: declareStatic(x) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// 18. Mixed: valid sugar + invalid sugar in same call — only $id errors
// $context is a static string (valid), $id is a variable reference (invalid).
describe('edge: mixed valid and invalid sugar vars reports only invalid', () => {
  ruleTester.run('mixed-valid-invalid-sugar', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "valid", $id: someVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 19. getGT pattern with sugar vars — error
// const gt = await getGT() requires 'gt-next' in libs for recognition.
// Sugar variable validation applies to getGT-derived gt() calls too.
describe('edge: getGT pattern with dynamic sugar var is error', () => {
  ruleTester.run('getgt-sugar-error', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { getGT } from 'gt-next';
          async function handler() {
            const gt = await getGT();
            return gt("Hello", { $context: dynamicVar });
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// 20. msg() with all four sugar vars, all valid — no errors
// Tests that all four sugar variable types pass validation simultaneously.
describe('edge: msg() with all four valid sugar vars passes', () => {
  ruleTester.run('msg-all-sugar-valid', staticString, {
    valid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello", { $context: "ctx", $id: "id", $format: "ICU", $maxChars: 100 });
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
