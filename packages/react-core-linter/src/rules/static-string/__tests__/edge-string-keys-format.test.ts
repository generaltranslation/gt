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
// Edge cases for string-literal property keys, template literal format
// values, and non-object second argument behavior.
//
// These tests exercise recent bug fixes:
// - String-literal keys ("$context") are now validated by getPropertyKeyName
// - Template literal $format values (`STRING`) are read by getFormatOption
// - Non-object second arguments cause the auto-fix to return null
// ===================================================================

// -------------------------------------------------------------------
// 1. String-literal key for $maxChars with number value — valid
// -------------------------------------------------------------------
describe('string-literal key "$maxChars" with number value is valid', () => {
  ruleTester.run('string-key-maxchars-number', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$maxChars": 50 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// -------------------------------------------------------------------
// 2. String-literal key for $maxChars with string value — error
// $maxChars requires a number literal, not a string.
// -------------------------------------------------------------------
describe('string-literal key "$maxChars" with string value is error', () => {
  ruleTester.run('string-key-maxchars-string', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$maxChars": "50" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 3. String-literal key "$context" with derive() in concatenation — valid
// isStaticOrDerive handles static + derive() concat for $context.
// -------------------------------------------------------------------
describe('string-literal key "$context" with derive concat is valid', () => {
  ruleTester.run('string-key-context-derive', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$context": "prefix " + derive(x) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// -------------------------------------------------------------------
// 4. Template literal $format value `I18NEXT` — disables ICU auto-fix
// getFormatOption now reads TemplateLiteral values via getStaticStringValue.
// Since I18NEXT !== ICU, isICUFormat returns false, so the fixer reports
// staticStringRequired instead of variableInterpolationRequired.
// -------------------------------------------------------------------
describe('template literal $format `I18NEXT` disables ICU auto-fix', () => {
  ruleTester.run('format-template-i18next', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $format: \`I18NEXT\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 5. Template literal $id value `my-id` (no interpolation) — valid
// isStaticString returns true for TemplateLiteral with zero expressions.
// -------------------------------------------------------------------
describe('template literal $id with no interpolation is valid', () => {
  ruleTester.run('id-template-static', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { $id: \`my-id\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// -------------------------------------------------------------------
// 6. Template literal $id with interpolation — error
// TemplateLiteral with expressions.length > 0 fails isStaticString.
// -------------------------------------------------------------------
describe('template literal $id with interpolation is error', () => {
  ruleTester.run('id-template-interpolation', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            const counter = 1;
            return gt("Hello", { $id: \`id-\${counter}\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 7. Mixed: string-literal key "$context" with dynamic value errors,
//    while identifier key $id with static string is valid.
//    Only one error is reported (for $context).
// -------------------------------------------------------------------
describe('mixed: string-key "$context" dynamic errors, identifier $id valid', () => {
  ruleTester.run('mixed-string-id-keys', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$context": dynamic, $id: "valid" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 8. Function call as second argument — no auto-fix applied
// gt("Hi " + name, someFunction()) has a non-object second arg,
// so the fixer returns null. Error is reported without fix.
// -------------------------------------------------------------------
describe('function call as second arg — report error, no fix', () => {
  ruleTester.run('func-call-second-arg-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hi " + name, someFunction());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 9. Ternary expression as second argument — no auto-fix applied
// gt("Hi " + name, condition ? opts1 : opts2) cannot be merged.
// -------------------------------------------------------------------
describe('ternary as second arg — report error, no fix', () => {
  ruleTester.run('ternary-second-arg-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hi " + name, condition ? opts1 : opts2);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 10. Spread as second argument — SpreadElement
// Spread elements in call arguments are typed as SpreadElement.
// The rule reports variableInterpolationRequired for spread first args,
// but for a second arg that's a spread, the first arg is the issue.
// The spread second arg is a non-object, so no auto-fix.
// -------------------------------------------------------------------
describe('spread as second arg — report error on first arg, no fix', () => {
  ruleTester.run('spread-second-arg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hi " + name, ...spread);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// -------------------------------------------------------------------
// 11. Single-quoted string key '$context' — valid with static value
// JS treats single-quoted and double-quoted strings identically;
// the AST Literal node has the same .value either way.
// -------------------------------------------------------------------
describe("single-quoted string key '$context' with static value is valid", () => {
  ruleTester.run('single-quote-string-key-context', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { '$context': 'greeting' });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// -------------------------------------------------------------------
// 12. All four sugar vars with string-literal keys, all valid
// Verifies that every sugar variable is recognized and validated
// when using string-literal property keys.
// -------------------------------------------------------------------
describe('all four sugar vars with string-literal keys — all valid', () => {
  ruleTester.run('all-string-key-sugar-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$context": "ctx", "$id": "id", "$format": "ICU", "$maxChars": 100 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
