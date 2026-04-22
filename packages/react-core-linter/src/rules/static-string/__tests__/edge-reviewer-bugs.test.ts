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
// Bug 1: escapeICUText produces wrong quoting when } appears before {
// The apostrophe from }' pairs with the apostrophe from '{, leaving
// the { unescaped. Each brace must be independently quoted: '{' and '}'.
// ===================================================================

// gt("} { " + name)
// → gt("'}' '{' {var0}", { var0: name })
// Both braces independently ICU-quoted
describe('bug: } before { in static text — braces independently quoted', () => {
  ruleTester.run('icu-escape-brace-order', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("} { " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("'}' '{' {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt("}{ " + name)
// → gt("'}''{' {var0}", { var0: name })
// Adjacent braces: each quoted independently, '' between them is escaped apostrophe
describe('bug: }{ adjacent in static text — each brace quoted independently', () => {
  ruleTester.run('icu-escape-adjacent-braces', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("}{ " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("'}''{' {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt("solo } here " + name)
// → gt("solo '}' here {var0}", { var0: name })
// Lone } must not leave a dangling apostrophe
describe('bug: solo } in static text — properly self-contained quote', () => {
  ruleTester.run('icu-escape-solo-close-brace', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("solo } here " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("solo '}' here {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt("solo { here " + name)
// → gt("solo '{' here {var0}", { var0: name })
// Lone { must not leave a dangling apostrophe
describe('bug: solo { in static text — properly self-contained quote', () => {
  ruleTester.run('icu-escape-solo-open-brace', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("solo { here " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("solo '{' here {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Bug 2: getFormatOption ignores template literal $format values
// `STRING` is valid for sugar validation but getFormatOption can't
// read it, so isICUFormat returns true and ICU auto-fix is applied.
// ===================================================================

// gt("Hello " + name, { $format: `STRING` })
// Should report staticStringRequired (no ICU auto-fix) because format is STRING
describe('bug: $format as template literal should disable ICU auto-fix', () => {
  ruleTester.run('format-template-literal', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $format: \`STRING\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// gt("Hello " + name, { $format: `ICU` })
// Explicit ICU via template literal — auto-fix should apply
describe('bug: $format as template literal ICU should enable auto-fix', () => {
  ruleTester.run('format-template-icu', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $format: \`ICU\` });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {var0}", { $format: \`ICU\`, var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Bug 3: String-literal property keys bypass sugar validation
// { "$context": dynamicVar } is semantically identical to
// { $context: dynamicVar } but the linter skips it.
// ===================================================================

// gt("Hello", { "$context": dynamicVar })
// Should report sugarVariableMustBeStatic
describe('bug: string-literal key "$context" should be validated', () => {
  ruleTester.run('string-key-context', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$context": dynamicVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello", { "$id": computedId })
// Should report sugarVariableMustBeStatic
describe('bug: string-literal key "$id" should be validated', () => {
  ruleTester.run('string-key-id', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$id": computedId });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello " + name, { "$format": "STRING" })
// String-literal key $format should be read — disables ICU auto-fix
describe('bug: string-literal key "$format" should be read by getFormatOption', () => {
  ruleTester.run('string-key-format', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { "$format": "STRING" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// gt("Hello", { "$context": "valid" })
// String-literal key with static value — should pass (no error)
describe('bug: string-literal key "$context" with static value is valid', () => {
  ruleTester.run('string-key-context-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello", { "$context": "greeting" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// Bug 4: Non-object second argument produces 3-argument call
// gt("Hello " + name, opts) should NOT be auto-fixed because we
// can't safely merge into a non-object second argument.
// ===================================================================

// gt("Hello " + name, opts)
// Should report error but NOT apply fix (would produce 3-arg call)
describe('bug: non-object second argument — no auto-fix', () => {
  ruleTester.run('non-object-second-arg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, opts);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// gt(`Hello ${name}`, getOptions())
// Same issue — function call as second arg, no safe fix
describe('bug: function call second argument — no auto-fix', () => {
  ruleTester.run('func-call-second-arg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(\`Hello \${name}\`, getOptions());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// ===================================================================
// Bug 5: Dynamic $format should not trigger ICU validation on content
// ===================================================================

// gt("Hello {}", { $format: dynamicVar })
// Should only report sugarVariableMustBeStatic on dynamicVar,
// NOT invalidICUFormat on the content (format is unknown, not necessarily ICU)
describe('bug: dynamic $format should not trigger ICU validation on content', () => {
  ruleTester.run('dynamic-format-no-icu-validation', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {}", { $format: dynamicVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'sugarVariableMustBeStatic' }],
      },
    ],
  });
});

// gt("Hello " + name, { $format: dynamicVar })
// Dynamic format + dynamic content: should report variableInterpolationRequired
// (auto-fix applied since format is unknown, defaulting to ICU is wrong)
// Actually should report staticStringRequired with no fix since format is uncertain
describe('bug: dynamic $format with dynamic content — no ICU auto-fix', () => {
  ruleTester.run('dynamic-format-dynamic-content', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $format: dynamicVar });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'staticStringRequired' },
          { messageId: 'sugarVariableMustBeStatic' },
        ],
      },
    ],
  });
});
