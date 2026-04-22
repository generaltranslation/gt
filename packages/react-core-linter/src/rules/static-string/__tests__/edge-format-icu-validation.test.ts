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
// 1. $format as template literal — isStaticString in sugar-fix.ts
//    considers template literals without interpolation as static,
//    so `ICU` passes sugar validation. However, getFormatOption only
//    reads Literal nodes, so the format is treated as null (unknown),
//    which means isICUFormat returns true → auto-fix applies.
//    Only 1 error: variableInterpolationRequired (no sugarVariableMustBeStatic).
// ===================================================================

describe('format-gating: $format as template literal `ICU` → auto-fix applies, no sugar error', () => {
  ruleTester.run('format-template-literal', staticString, {
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
// 2. $format as computed value — getFormatOption returns undefined (present but dynamic),
//    isICUFormat returns false. Dynamic concat → staticStringRequired (no ICU auto-fix).
//    The computed $format value also triggers sugarVariableMustBeStatic.
// ===================================================================

describe('format-gating: $format as computed value getFormat() → errors for dynamic concat and sugar', () => {
  ruleTester.run('format-computed-value', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + name, { $format: getFormat() });
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

// ===================================================================
// 3. Nested ICU: plural with # (pound sign)
// ===================================================================

describe('icu-validation: nested ICU plural with # is valid', () => {
  ruleTester.run('nested-plural-hash', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{count, plural, one {# item} other {# items}}");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 4. ICU with number format skeleton
// ===================================================================

describe('icu-validation: ICU number format with skeleton is valid', () => {
  ruleTester.run('number-format-skeleton', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{price, number, ::currency/USD}");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 5. Unbalanced braces at end — invalid ICU
// ===================================================================

describe('icu-validation: unbalanced opening brace at end is invalid', () => {
  ruleTester.run('unbalanced-open-brace', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {"); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 6. Extra closing brace — the ICU parser (@formatjs) treats
//    unmatched closing braces as literal text, so "Hello }" is
//    actually valid ICU. This test documents that behavior.
// ===================================================================

describe('icu-validation: extra closing brace is treated as literal text (valid ICU)', () => {
  ruleTester.run('extra-close-brace-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello }"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 7. Nested select inside plural — valid complex ICU
// ===================================================================

describe('icu-validation: nested select in plural is valid', () => {
  ruleTester.run('nested-select-in-plural', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{gender, select, male {{count, plural, one {He has # item} other {He has # items}}} other {They have items}}");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 8. msg() array: second element with invalid ICU
// ===================================================================

describe('icu-validation: msg() array with valid first and invalid second element', () => {
  ruleTester.run('msg-array-mixed-validity', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const items = msg(["valid {name}", "invalid {"]);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 9. ICU with selectordinal — valid
// ===================================================================

describe('icu-validation: selectordinal is valid ICU', () => {
  ruleTester.run('selectordinal-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 10. Static concat producing valid ICU — already covered in
//     edge-icu-validation but with different content here
// ===================================================================

describe('icu-validation: static concat of two parts producing valid ICU', () => {
  ruleTester.run('static-concat-valid-icu', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + "{name}!");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 11. Static concat producing invalid ICU
// ===================================================================

describe('icu-validation: static concat producing invalid ICU reports error', () => {
  ruleTester.run('static-concat-invalid-icu', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello " + "{name");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 12. Template literal (no interpolation) with invalid ICU
// ===================================================================

describe('icu-validation: static template literal with invalid ICU', () => {
  ruleTester.run('template-literal-invalid-icu', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt(\`Hello {broken\`); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 13. $format: "STRING" with invalid ICU-like content — no error
// ===================================================================

describe('format-gating: $format STRING with ICU-like invalid content → no error', () => {
  ruleTester.run('format-string-no-icu-validation', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("Hello {broken", { $format: "STRING" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 14. msg() with $format: "STRING" and dynamic content →
//     staticStringRequired (no auto-fix)
// ===================================================================

describe('format-gating: msg() with $format STRING and dynamic content → staticStringRequired', () => {
  ruleTester.run('msg-format-string-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello " + name, { $format: "STRING" });
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// ===================================================================
// 15. gt() with no second argument and valid ICU — no error
// ===================================================================

describe('icu-validation: gt() with no options and valid ICU placeholder → no error', () => {
  ruleTester.run('no-options-valid-icu', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{name}");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
