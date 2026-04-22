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
// Sugar variables ($context, $id, $format, $maxChars) must be static.
// No ICU auto-fix applies to these — they are metadata, not content.
// ===================================================================

// ===================================================================
// 1. $context — static string, supports derive()/declareStatic()
// ===================================================================

// gt("Hello", { $context: "greeting" })  — valid, static string
// gt("Hello", { $context: `greeting` })  — valid, static template literal
describe('static-string: $context with static string is valid', () => {
  ruleTester.run('context-static-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
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

// gt("Hello", { $context: "formal " + derive(getStyle()) })  — valid, derive() is allowed in $context
// gt("Hello", { $context: derive(getCtx()) })                — valid, standalone derive()
// gt("Hello", { $context: "prefix " + declareStatic(x) })    — valid, declareStatic() alias
describe('static-string: $context with derive()/declareStatic() is valid', () => {
  ruleTester.run('context-derive-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "formal " + derive(getStyle()) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: derive(getCtx()) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      {
        code: `
          import { useGT, declareStatic } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "prefix " + declareStatic(x) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello", { $context: someVar })  — invalid, dynamic value
describe('static-string: $context with dynamic value → error', () => {
  ruleTester.run('context-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: someVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $context: `ctx ${value}` })  — invalid, template with interpolation
describe('static-string: $context with template interpolation → error', () => {
  ruleTester.run('context-template-interp', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: \`ctx \${value}\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $context: "prefix " + dynamicValue })  — invalid, concat with non-static non-derive
describe('static-string: $context with dynamic concat (no derive) → error', () => {
  ruleTester.run('context-dynamic-concat', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "prefix " + dynamicValue });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// msg("Hello", { $context: someVar })  — invalid, msg() also enforces static $context
describe('static-string: msg() $context with dynamic value → error', () => {
  ruleTester.run('msg-context-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello", { $context: someVar });
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// ===================================================================
// 2. $id — static string only, NO derive() support
// ===================================================================

// gt("Hello", { $id: "greeting-1" })  — valid
// gt("Hello", { $id: `greeting-1` })  — valid (static template literal)
describe('static-string: $id with static string is valid', () => {
  ruleTester.run('id-static-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: "greeting-1" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: \`greeting-1\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello", { $id: someVar })  — invalid, dynamic value
describe('static-string: $id with dynamic value → error', () => {
  ruleTester.run('id-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: someVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $id: `id-${counter}` })  — invalid, template with interpolation
describe('static-string: $id with template interpolation → error', () => {
  ruleTester.run('id-template-interp', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: \`id-\${counter}\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $id: derive(getId()) })  — invalid, derive() NOT supported for $id
describe('static-string: $id with derive() → error (derive not supported for $id)', () => {
  ruleTester.run('id-derive-invalid', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $id: derive(getId()) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// ===================================================================
// 3. $format — static string only, NO derive() support
// ===================================================================

// gt("Hello", { $format: "ICU" })     — valid
// gt("Hello", { $format: "STRING" })  — valid
// gt("Hello", { $format: "I18NEXT" }) — valid
describe('static-string: $format with valid static values is valid', () => {
  ruleTester.run('format-static-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: "ICU" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: "STRING" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: "I18NEXT" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello", { $format: formatVar })  — invalid, dynamic value
describe('static-string: $format with dynamic value → error', () => {
  ruleTester.run('format-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: formatVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $format: derive(getFormat()) })  — invalid, derive() NOT supported for $format
describe('static-string: $format with derive() → error (derive not supported for $format)', () => {
  ruleTester.run('format-derive-invalid', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $format: derive(getFormat()) });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// ===================================================================
// 4. $maxChars — static NUMBER only, NO derive() support
// ===================================================================

// gt("Hello", { $maxChars: 50 })  — valid, number literal
describe('static-string: $maxChars with number literal is valid', () => {
  ruleTester.run('maxchars-number-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: 50 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello", { $maxChars: charLimit })  — invalid, dynamic value
describe('static-string: $maxChars with dynamic value → error', () => {
  ruleTester.run('maxchars-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: charLimit });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { $maxChars: "50" })  — invalid, string is not a number
describe('static-string: $maxChars with string value → error', () => {
  ruleTester.run('maxchars-string', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $maxChars: "50" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// ===================================================================
// 5. Multiple sugar variables in same call
// ===================================================================

// gt("Hello", { $context: "greeting", $id: "g1", $format: "ICU", $maxChars: 100 })  — all valid
describe('static-string: multiple sugar variables all static → valid', () => {
  ruleTester.run('multi-sugar-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: "greeting", $id: "g1", $format: "ICU", $maxChars: 100 });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello", { $context: ctx, $id: id })  — both dynamic, reports error for each
describe('static-string: multiple dynamic sugar variables → error for each', () => {
  ruleTester.run('multi-sugar-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello", { $context: ctx, $id: id });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'sugarVariableMustBeStatic' },
          { messageId: 'sugarVariableMustBeStatic' },
        ],
      },
    ],
  });
});

// ===================================================================
// 6. Sugar variables don't interfere with content string validation
// ===================================================================

// gt("Hello " + name, { $context: "greeting" })  — content error + valid sugar
describe('static-string: dynamic content with valid sugar → content error only', () => {
  ruleTester.run('content-error-sugar-valid', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name, { $context: "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}", { $context: "greeting", var0: name });
          }
        `,
      },
    ],
  });
});

// gt("Hello " + name, { $context: ctx })  — content error (with fix) + sugar error (no fix)
// → gt("Hello {var0}", { $context: ctx, var0: name })  (content fixed, $context still invalid)
describe('static-string: dynamic content with dynamic sugar → both errors', () => {
  ruleTester.run('content-and-sugar-errors', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name, { $context: ctx });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'variableInterpolationRequired' },
          { messageId: 'sugarVariableMustBeStatic' },
        ],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}", { $context: ctx, var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Non-sugar variables in options are ignored (they're ICU params)
// ===================================================================

// gt("Hello {name}!", { name: userName })  — valid, name is an ICU param not a sugar var
describe('static-string: non-sugar options keys are ignored (ICU params)', () => {
  ruleTester.run('non-sugar-ignored', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {name}!", { name: userName, count: items.length });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
